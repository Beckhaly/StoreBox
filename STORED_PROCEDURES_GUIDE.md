# StoreBox — Guide Procédures Stockées

## Architecture

```
Backend (Express/TypeScript)
├── Routes (routes/*.ts)
│   └── Appellent UNIQUEMENT des functions helper
└── Helper SP (lib/sp.ts)
    └── Appellent UNIQUEMENT des procédures PostgreSQL

PostgreSQL
└── Procédures Stockées (migrations/015_stored_procedures.sql)
    └── Contiennent TOUTE la logique métier
```

**Avantages** :
✅ Zéro requête SQL dans le backend  
✅ Logique métier centralisée en PostgreSQL  
✅ Performance (SP optimisées)  
✅ Sécurité (SQL injection impossible)  
✅ Testable (tester les SP directement)  

---

## Exemple : Refactor Ventes

### Avant (SQL dans Express)

```typescript
// routes/ventes.ts
export const ventesRouter = Router();

ventesRouter.get('/', wrap(async (req, res) => {
  const tid = req.user!.tenant_id;
  const { rows } = await db.query(
    `SELECT v.*, c.raison_sociale, mp.nom
     FROM ventes v
     JOIN clients c ON c.id = v.client_id
     LEFT JOIN moyens_paiement mp ON mp.id = v.moyen_paiement_id
     WHERE v.tenant_id = $1
     ORDER BY v.date_vente DESC
     LIMIT 100`,
    [tid]
  );
  ok(res, rows);
}));
```

### Après (SP dans Express)

```typescript
// routes/ventes.ts
import { spVentesList } from '../lib/sp';

export const ventesRouter = Router();

ventesRouter.get('/', wrap(async (req, res) => {
  const tid = req.user!.tenant_id;
  const ventes = await spVentesList(tid, 100, 0);
  ok(res, ventes);
}));
```

**Tout le SELECT a été déplacé dans la SP** `sp_ventes_list()` ✅

---

## Comment ajouter une SP

### 1. Créer la SP dans PostgreSQL

```sql
-- migrations/015_stored_procedures.sql (ou 016, 017...)
CREATE OR REPLACE FUNCTION sp_mon_operation(
  p_param1 INT,
  p_param2 VARCHAR,
  p_param3 DATE DEFAULT NULL
)
RETURNS TABLE (
  id INT,
  resultat VARCHAR,
  date_calcul DATE
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      mon_table.id,
      mon_table.nom || ' - traite',
      CURRENT_DATE
    FROM mon_table
    WHERE mon_table.param1 = p_param1
      AND (p_param2 IS NULL OR mon_table.champ = p_param2);
END;
$$ LANGUAGE plpgsql;
```

### 2. Ajouter helper dans `lib/sp.ts`

```typescript
export async function spMonOperation(
  param1: number,
  param2?: string,
  param3?: string
) {
  return callSP('sp_mon_operation', {
    p_param1: param1,
    p_param2: param2 || null,
    p_param3: param3 || null,
  });
}
```

### 3. Utiliser dans la route

```typescript
import { spMonOperation } from '../lib/sp';

router.get('/mon-endpoint', wrap(async (req, res) => {
  const resultats = await spMonOperation(123, 'valeur');
  ok(res, resultats);
}));
```

---

## Patterns courants

### Retourner une seule ligne (SELECT)

```typescript
// SP retourne TABLE(...), mais on veut 1 résultat
const user = await callSPScalar('sp_utilisateur_get', { p_id: 123 });
// user = { id: 123, nom: '...', ... }
```

### Retourner plusieurs lignes (SELECT + JOIN)

```typescript
const ventes = await spVentesList(tenantId);
// ventes = [{ id: 1, numero: 'VTE-1001', ... }, { id: 2, ... }]
```

### INSERT/UPDATE/DELETE (sp_xxx_create, sp_xxx_update, sp_xxx_delete)

```typescript
// SP effectue l'opération et retourne l'objet créé
const nouvelleLigne = await spVentesCreate({
  tenantId: 1,
  clientId: 5,
  typeVente: 'gros',
  dateVente: '2026-05-01',
  sousTotal: 100000,
  remisePct: 0,
  remiseMontant: 0,
  tvaPct: 18,
  tvaMontant: 18000,
  totalTtc: 118000,
});
// nouvelleLigne = { id: 42, numero: 'VTE-1042' }
```

### Opérations complexes (transactions, loops)

```sql
-- SP gère la transaction complètement
CREATE OR REPLACE FUNCTION sp_ventes_et_mouvements_stock(
  p_tenant_id INT,
  -- ... paramètres
)
RETURNS TABLE (...) AS $$
BEGIN
  -- Insérer la vente
  INSERT INTO ventes (...) VALUES (...) RETURNING id INTO v_vente_id;

  -- Boucle sur les lignes
  FOREACH v_ligne IN ARRAY p_lignes
  LOOP
    INSERT INTO ventes_lignes (...) VALUES (...);
    UPDATE produits SET stock = stock - v_ligne.qte WHERE id = v_ligne.produit_id;
    INSERT INTO mouvements_stock (...) VALUES (...);
  END LOOP;

  RETURN QUERY SELECT * FROM ventes WHERE id = v_vente_id;
END;
$$ LANGUAGE plpgsql;
```

Backend :
```typescript
const vente = await callSPScalar('sp_ventes_et_mouvements_stock', {
  p_tenant_id: 1,
  // ...
});
```

---

## Génération automatique des SP

Pour un app avec 50+ routes, générer les SP devient répétitif.

### Template SQL

```sql
-- Template : SELECT
CREATE OR REPLACE FUNCTION sp_{{ TABLE }}_list(
  p_tenant_id INT,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
    SELECT * FROM {{ TABLE }}
    WHERE tenant_id = p_tenant_id
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Template : INSERT
CREATE OR REPLACE FUNCTION sp_{{ TABLE }}_create(
  p_tenant_id INT,
  {{ COLUMNS_AS_PARAMS }}
)
RETURNS TABLE (id INT) AS $$
BEGIN
  INSERT INTO {{ TABLE }} (tenant_id, {{ COLUMNS }})
  VALUES (p_tenant_id, {{ VALUES }})
  RETURNING id;
END;
$$ LANGUAGE plpgsql;
```

### Script de génération (Node.js)

```typescript
// scripts/generate-sps.ts
import * as fs from 'fs';

const tables = [
  { name: 'produits', columns: ['reference', 'designation', 'prix_achat'] },
  { name: 'clients', columns: ['code', 'raison_sociale', 'telephone'] },
  // ...
];

for (const table of tables) {
  const spList = generateSPList(table);
  const spCreate = generateSPCreate(table);
  fs.appendFileSync('migrations/999_auto_generated_sps.sql', spList + '\n\n' + spCreate);
}

function generateSPList(table) {
  const cols = table.columns.map(c => `    p_${c} VARCHAR DEFAULT NULL`).join(',\n');
  return `CREATE OR REPLACE FUNCTION sp_${table.name}_list(...)...`;
}
```

Exécuter : `npm run generate:sps`

---

## Testing des SP

### Test direct en psql

```bash
# Tester sp_ventes_list
psql $DATABASE_URL << EOF
SELECT * FROM sp_ventes_list(1, 10, 0);
EOF
```

### Test dans Jest

```typescript
import { spVentesList } from '../lib/sp';

describe('Stored Procedures', () => {
  test('sp_ventes_list returns ventes', async () => {
    const ventes = await spVentesList(1);
    expect(ventes).toBeInstanceOf(Array);
    expect(ventes[0]).toHaveProperty('numero');
  });
});
```

---

## Checklist migration vers SP

- [ ] Créer migration 015_stored_procedures.sql
- [ ] Créer lib/sp.ts avec tous les helpers
- [ ] Refactor routes/auth.ts (login, refresh, me)
- [ ] Refactor routes/ventes.ts (list, create, update, delete)
- [ ] Refactor routes/clients.ts
- [ ] Refactor routes/creances.ts
- [ ] Refactor routes/produits.ts
- [ ] Refactor routes/index.ts (dashboard, rapports, etc.)
- [ ] Tester chaque SP en psql
- [ ] Tester chaque route en curl/Postman
- [ ] Supprimer les requêtes SQL du backend
- [ ] Code review : zéro `db.query(SELECT...WHERE)` dans les routes

---

## Performance & monitoring

### Indexes sur les SP

```sql
-- Déjà ajoutés dans 015_stored_procedures.sql
CREATE INDEX idx_sp_ventes_tenant ON ventes(tenant_id, date_vente DESC);
CREATE INDEX idx_sp_clients_tenant ON clients(tenant_id, raison_sociale);
-- ...
```

### EXPLAIN sur les SP

```bash
psql $DATABASE_URL << EOF
EXPLAIN ANALYZE SELECT * FROM sp_ventes_list(1, 100, 0);
EOF
```

### Monitoring (pgAdmin)

- Vérifier temps d'exécution des SP
- Vérifier les locks
- Vérifier les plans de requête

---

## Notes importantes

⚠️ **Transactions** :
- SP gère les transactions (BEGIN/COMMIT/ROLLBACK)
- Backend **n'appelle que** la SP, pas `db.connect()` + boucles

⚠️ **Erreurs** :
- Les erreurs PostgreSQL remontent dans le `.catch()` du backend
- Ajouter des `RAISE` explicites dans les SP pour clarifier

⚠️ **Sécurité** :
- Les SP héritent des permissions PostgreSQL (role-based)
- Pas besoin de vérifier tenant_id côté Node (la SP le fait)

⚠️ **Versionning** :
- Versionner les migrations SQL (comme d'habitude)
- Si une SP change de signature, mettre à jour le helper TypeScript

---

## Prochaines étapes

1. ✅ Appliquer migration 015_stored_procedures.sql
2. ✅ Refactor **auth.ts** (1er), **ventes.ts** (2ème), **clients.ts** (3ème)
3. ⏳ Refactor les ~40 autres routes progressivement
4. ⏳ Générer les SP restantes avec un script
5. ✅ Supprimer la couche SQL du backend
