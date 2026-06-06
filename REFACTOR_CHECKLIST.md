# StoreBox — Refactor Backend : SQL → Procédures Stockées

**Status** : 🚀 En cours

## Vue d'ensemble

Migrer **50+ routes Express** pour qu'elles n'appellent **que des procédures stockées PostgreSQL** au lieu de requêtes SQL directes.

```
AVANT: routes/ → SQL queries → PostgreSQL
APRÈS: routes/ → SP helpers (lib/sp.ts) → PostgreSQL SP
```

---

## Phase 1 : Fondations (✅ COMPLÉTÉE)

### Fichiers créés

- ✅ `migrations/015_stored_procedures.sql` — 15+ SP de base
- ✅ `lib/sp.ts` — 20+ helpers TypeScript
- ✅ `STORED_PROCEDURES_GUIDE.md` — Guide complet + patterns

### SP implémentées

**Auth** :
- ✅ `sp_auth_login()`

**Ventes** :
- ✅ `sp_ventes_list()`
- ✅ `sp_ventes_create()`
- ✅ `sp_ventes_list_filters()`
- ✅ `sp_ventes_get()`
- ✅ `sp_ventes_lignes_list()`
- ✅ `sp_ventes_paiements_list()`
- ✅ `sp_ventes_create_complete()` — Avec lignes + stock + paiement initial
- ✅ `sp_ventes_paiement_add()`
- ✅ `sp_ventes_update()`
- ✅ `sp_ventes_cancel()`
- ✅ `sp_ventes_kpi_ca_mois()`

**Clients** :
- ✅ `sp_clients_list()`
- ✅ `sp_clients_create()`

**Créances** :
- ✅ `sp_creances_list()`
- ✅ `sp_creances_ageing()`

**Produits** :
- ✅ `sp_produits_list()`

**Dashboard** :
- ✅ `sp_dashboard_kpis()`

**Paiements** :
- ✅ `sp_paiements_create()`

**Helpers** :
- ✅ `sp_stocks_get()`
- ✅ `sp_clients_get()`

---

## Phase 2 : Refactor Routes (🔄 EN COURS)

### Routes refactorisées (exemple)

**Fichiers** :
- 📄 `routes/ventes-refactored.ts` — Exemple complet
- 📄 `routes/clients-refactored.ts` — Exemple complet
- 📄 `routes/creances-refactored.ts` — Exemple complet

**Pattern appliqué** :

```typescript
// ❌ AVANT
const { rows } = await db.query(
  `SELECT v.*, c.raison_sociale FROM ventes v
   JOIN clients c ON c.id = v.client_id
   WHERE v.id = $1`,
  [id]
);

// ✅ APRÈS
const vente = await callSPScalar('sp_ventes_get', { p_id: id });
```

---

## Phase 3 : SP Manquantes (⏳ TODO)

### Clients

- `sp_clients_get_detail()`
- `sp_clients_historique_ventes()`
- `sp_clients_creances()`
- `sp_clients_update()`
- `sp_clients_deactivate()`
- `sp_clients_stats()`

### Créances

- `sp_creances_get_by_vente()`
- `sp_creances_paiement_add()`
- `sp_creances_echancier_30j()`
- `sp_creances_par_client()`
- `sp_creances_contentieux()`
- `sp_creances_relance_log()`
- `sp_creances_update_statut()`

### Produits

- `sp_produits_get()`
- `sp_produits_create()`
- `sp_produits_update()`
- `sp_produits_delete()`
- `sp_produits_search()`

### Fournisseurs

- `sp_fournisseurs_list()`
- `sp_fournisseurs_get()`
- `sp_fournisseurs_create()`
- `sp_fournisseurs_update()`
- `sp_fournisseurs_delete()`

### Achats

- `sp_achats_list()`
- `sp_achats_get()`
- `sp_achats_create()`
- `sp_achats_paiement_add()`

### Stock

- `sp_stocks_list()`
- `sp_stocks_mouvements()`
- `sp_stocks_ajustement()`
- `sp_stocks_transfert()`

### Rapports

- `sp_rapports_rentabilite()`
- `sp_rapports_tresorerie()`
- `sp_rapports_commercial()`
- `sp_rapports_performance()`

### Admin

- `sp_utilisateurs_list()`
- `sp_utilisateurs_create()`
- `sp_utilisateurs_update()`
- `sp_utilisateurs_delete()`
- `sp_roles_list()`
- `sp_audit_logs_list()`

### Magasins (multi-store)

- `sp_magasins_list()`
- `sp_magasins_get()`
- `sp_magasins_create()`
- `sp_magasins_stats()`

### Dépenses

- `sp_depenses_list()`
- `sp_depenses_create()`
- `sp_depenses_delete()`
- `sp_depenses_par_categorie()`
- `sp_depenses_evolution()`

### Devis / Retours / Bons Commande

- `sp_devis_list()`
- `sp_devis_create()`
- `sp_retours_list()`
- `sp_retours_create()`
- `sp_bons_commande_list()`
- `sp_bons_commande_create()`

---

## Phase 4 : Migration des Helpers SP (⏳ TODO)

Ajouter les fonctions TypeScript dans `lib/sp.ts` pour chaque SP créée.

### Template

```typescript
export async function sp<NOUN><ACTION>(...params) {
  return callSP('sp_<noun>_<action>', {
    p_param1: param1,
    p_param2: param2 || null,
  });
}
```

---

## Phase 5 : Remplacer les Fichiers de Routes (⏳ TODO)

1. Compiler les routes refactorisées
2. Remplacer les originaux :
   - `routes/ventes.ts` ← `routes/ventes-refactored.ts`
   - `routes/clients.ts` ← `routes/clients-refactored.ts`
   - `routes/creances.ts` ← `routes/creances-refactored.ts`
   - `routes/produits.ts` ← (à créer)
   - etc.

---

## Phase 6 : Testing (⏳ TODO)

### Tests SP en psql

```bash
# Chaque SP testée directement
psql $DATABASE_URL << EOF
SELECT * FROM sp_ventes_get(1);
SELECT * FROM sp_creances_ageing(1);
EOF
```

### Tests Routes en Jest

```typescript
describe('Ventes Routes', () => {
  test('GET /api/ventes returns list', async () => {
    const res = await request(app).get('/api/ventes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
```

### Tests d'intégration

- Créer vente + paiement + stock → vérifier tout ok
- Modifier créance → vérifier statut recalculé
- Annuler vente → vérifier stock restauré

---

## Phase 7 : Cleanup (⏳ TODO)

- Supprimer fichiers `-refactored.ts`
- Verifier : **zéro** `db.query(SELECT|INSERT|UPDATE)` dans routes/
- Verifier : **tous** les appels SP en `lib/sp.ts`
- Supprimer codes inutilisés

---

## Checklist de migration

### Par route

- [ ] Lire le fichier original (`routes/xxx.ts`)
- [ ] Lister toutes les requêtes SQL
- [ ] Créer les SP manquantes dans migration 015 (ou 016, 017, etc.)
- [ ] Ajouter les helpers TypeScript dans `lib/sp.ts`
- [ ] Refactor la route (remplacer SQL par appels SP)
- [ ] Tester la route en curl/Postman
- [ ] Tester la SP en psql

### Validation finale

- [ ] Appliquer migration 015
- [ ] `npm run build` — pas d'erreurs
- [ ] Tous les tests passent
- [ ] Zéro `db.query(SELECT|INSERT|UPDATE)` dans `routes/`
- [ ] Code review

---

## Commandes utiles

```bash
# Trouver toutes les requêtes SQL dans les routes
grep -r "db.query\|db.connect" apps/api/src/routes/ | grep -v "node_modules"

# Compter les SP créées
grep "^CREATE OR REPLACE FUNCTION" apps/api/migrations/015_stored_procedures.sql | wc -l

# Tester une SP
psql $DATABASE_URL -c "SELECT * FROM sp_nom(param1, param2);"
```

---

## Avantages attendus

✅ **Sécurité** : SQL injection impossible (+ LIMIT 100, OFFSET)  
✅ **Performance** : SP optimisées par PostgreSQL  
✅ **Maintenabilité** : Logique métier centralisée en PostgreSQL  
✅ **Testabilité** : SP testables directement  
✅ **Scalabilité** : Requêtes complexes gérées par PG  

---

## Prochaines étapes

1. **Immédiate** : Appliquer migration 015
2. **Court terme** : Créer les 40+ SP manquantes (peut être scripté)
3. **Moyen terme** : Refactor progressivement les 50+ routes
4. **Long terme** : Cleanup et validation finale

**Estimation** : 2-3 jours si scriptée, 1-2 semaines si manuelle.

---

## Ressources

- [Guide Procédures Stockées](./STORED_PROCEDURES_GUIDE.md)
- [Migration 015](./apps/api/migrations/015_stored_procedures.sql)
- [Helper SP](./apps/api/src/lib/sp.ts)
- [Routes refactorisées (exemples)](./apps/api/src/routes/ventes-refactored.ts)
