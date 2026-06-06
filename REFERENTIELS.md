# Tables de Référence - Guide Complet

## Vue d'ensemble

Les énumérations hardcodées dans la base de données et l'application ont été refactorisées en **tables de référence dynamiques**. Cela permet une meilleure maintenance et la gestion centralisée des listes de valeurs.

## Tables créées

| Table | Description | Clés |
|-------|-------------|------|
| `types_clients` | Grossiste, Détaillant, Particulier | code, libelle, ordre |
| `statuts_clients` | Statuts client (actif, inactif, bloqué, contentieux) | code, libelle, couleur |
| `types_ventes` | Gros, Détail | code, libelle |
| `statuts_paiements_ventes` | Statuts paiement ventes | code, libelle, couleur |
| `statuts_paiements_achats` | Statuts paiement achats | code, libelle, couleur |
| `types_mouvements_stock` | Entrée, Sortie, Ajustement, Retour | code, libelle, signe |
| `canaux_notification` | SMS, WhatsApp, Email | code, libelle, icone |
| `statuts_notification` | Envoyé, Échec, En attente | code, libelle, couleur |
| `statuts_devis` | Brouillon, Envoyé, Accepté, Refusé, Expiré, Converti | code, libelle, couleur |
| `types_avoir` | Avoir, Remboursement, Échange | code, libelle |
| `statuts_avoir` | En attente, Traité, Annulé | code, libelle, couleur |
| `statuts_reception` | Brouillon, Envoyé, Confirmé, Réceptionné, Annulé | code, libelle, couleur |
| `types_paiement` | Encaissement, Décaissement | code, libelle |

## API REST

### Endpoints

```
GET    /api/referentiels                  # Récupère TOUS les référentiels actifs
GET    /api/referentiels/:type            # Récupère un type spécifique (actif)
GET    /api/referentiels/:type/all        # Récupère un type complet (admin)
GET    /api/referentiels/:type/:id        # Récupère un item spécifique
POST   /api/referentiels/:type            # Crée un nouvel item (admin)
PUT    /api/referentiels/:type/:id        # Modifie un item (admin)
DELETE /api/referentiels/:type/:id        # Désactive un item (admin)
```

### Exemples

#### GET /api/referentiels/types_clients
```json
{
  "success": true,
  "data": [
    { "id": 1, "code": "grossiste", "libelle": "Grossiste", "ordre": 1, "actif": true },
    { "id": 2, "code": "detaillant", "libelle": "Détaillant", "ordre": 2, "actif": true },
    { "id": 3, "code": "particulier", "libelle": "Particulier", "ordre": 3, "actif": true }
  ]
}
```

#### POST /api/referentiels/statuts_clients
```bash
curl -X POST http://localhost:3001/api/referentiels/statuts_clients \
  -H "Content-Type: application/json" \
  -d '{
    "code": "suspect",
    "libelle": "Client suspect",
    "couleur": "red",
    "ordre": 5
  }'
```

#### PUT /api/referentiels/statuts_clients/1
```bash
curl -X PUT http://localhost:3001/api/referentiels/statuts_clients/1 \
  -H "Content-Type: application/json" \
  -d '{ "libelle": "Client actif (VIP)" }'
```

#### DELETE /api/referentiels/statuts_clients/1
```bash
curl -X DELETE http://localhost:3001/api/referentiels/statuts_clients/1
```

## Frontend - Utilisation

### 1. Hook `useReferentiels` - Charger tous les référentiels

```typescript
import { useReferentiels } from '../hooks/useReferentiels';

function MonComposant() {
  const { data, loading, error } = useReferentiels();
  
  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;
  
  console.log(data.types_clients);    // Array<Referentiel>
  console.log(data.statuts_clients);  // Array<Referentiel>
  // ...
}
```

### 2. Hook `useReferentielType` - Charger un type spécifique

```typescript
import { useReferentielType } from '../hooks/useReferentiels';

function FormulaireSaisie() {
  const { items, loading, error } = useReferentielType('types_clients');
  
  return (
    <select>
      {items.map(item => (
        <option key={item.id} value={item.code}>
          {item.libelle}
        </option>
      ))}
    </select>
  );
}
```

### 3. Composant `ReferentielSelect` - Sélection simple

```typescript
import { ReferentielSelect } from '../components/ui/ReferentielSelect';

export default function ClientsPage() {
  const [typeClient, setTypeClient] = useState('');
  
  return (
    <ReferentielSelect
      type="types_clients"
      value={typeClient}
      onChange={setTypeClient}
      label="Type de client"
      placeholder="Sélectionner un type..."
      required
    />
  );
}
```

### 4. Composant `ReferentielBadge` - Affichage avec couleur

```typescript
import { ReferentielBadge } from '../components/ui/ReferentielSelect';

function ClientRow({ client }) {
  return (
    <tr>
      <td>{client.raison_sociale}</td>
      <td>
        <ReferentielBadge 
          type="statuts_clients" 
          code={client.statut}
        />
      </td>
    </tr>
  );
}
```

### 5. Hook `useReferentielCRUD` - Pour les admins

```typescript
import { useReferentielCRUD } from '../hooks/useReferentiels';

function AdminReferentielsPage() {
  const { create, update, delete: delete_, loading, error } = useReferentielCRUD('types_clients');
  
  const handleAdd = async () => {
    const result = await create('nouveau_code', 'Nouveau Type');
    if (result) console.log('Créé!', result);
  };
  
  const handleEdit = async (id: number) => {
    await update(id, { libelle: 'Nouveau libellé' });
  };
  
  const handleDelete = async (id: number) => {
    await delete_(id);
  };
}
```

## Migration - Changements required

### 1. **Database**
Exécuter la migration `011_referentiels.sql` :
```bash
npm run db:migrate
```

### 2. **Frontend - Mise à jour des pages existantes**

#### Avant (hardcoded):
```typescript
const typeOptions = [
  { value: 'grossiste', label: 'Grossiste' },
  { value: 'detaillant', label: 'Détaillant' },
  { value: 'particulier', label: 'Particulier' },
];

<select value={type} onChange={(e) => setType(e.target.value)}>
  {typeOptions.map(opt => <option value={opt.value}>{opt.label}</option>)}
</select>
```

#### Après (dynamique):
```typescript
<ReferentielSelect
  type="types_clients"
  value={type}
  onChange={setType}
  label="Type de client"
/>
```

### 3. **Backend - Pas de changement requis**
Les routes API acceptent les mêmes valeurs de code que avant (grossiste, detaillant, etc.).

## Gestion administrative

Accédez à la page **Admin Référentiels** pour :
- Voir tous les référentiels et leurs items
- Ajouter/modifier/supprimer des items
- Gérer les couleurs et icones
- Réordonner les éléments

URL: `/admin/referentiels`

## Seed de données par défaut

Tous les référentiels sont automatiquement peuplés avec les valeurs par défaut lors de la première migration :

```sql
INSERT INTO types_clients (code, libelle, ordre) VALUES
  ('grossiste', 'Grossiste', 1),
  ('detaillant', 'Détaillant', 2),
  ('particulier', 'Particulier', 3)
ON CONFLICT DO NOTHING;
```

## Types TypeScript

### Referentiel
```typescript
interface Referentiel {
  id:        number;
  code:      string;      // Clé unique (ex: 'actif', 'non_paye')
  libelle:   string;      // Label utilisateur (ex: 'Actif', 'Non payé')
  couleur?:  string;      // Couleur badge (red, green, blue, yellow, etc.)
  signe?:    number;      // Pour stocks: 1 (entrée) ou -1 (sortie)
  icone?:    string;      // Icone Feather (ex: 'mail', 'send')
  ordre:     number;      // Position dans la liste
  actif:     boolean;     // Est actif?
}
```

### AllReferentiels
```typescript
interface AllReferentiels {
  types_clients:              Referentiel[];
  statuts_clients:            Referentiel[];
  types_ventes:               Referentiel[];
  // ... tous les 13 référentiels
}
```

## Exemple complet : Utilisation dans VentesPage

```typescript
import { ReferentielSelect } from '../components/ui/ReferentielSelect';

export default function VentesPage() {
  const [typeVente, setTypeVente] = useState('');
  const [statut, setStatut] = useState('');

  return (
    <form>
      <ReferentielSelect
        type="types_ventes"
        value={typeVente}
        onChange={setTypeVente}
        label="Type de vente"
        required
      />
      
      <ReferentielSelect
        type="statuts_paiements_ventes"
        value={statut}
        onChange={setStatut}
        label="Statut de paiement"
      />
      
      <button type="submit">Rechercher</button>
    </form>
  );
}
```

## FAQ

**Q: Comment ajouter un nouveau type de statut?**
A: Via l'API `POST /api/referentiels/statuts_clients` ou via la page AdminReferentiels.

**Q: Est-ce que les anciens codes (ex: 'actif') continuent de fonctionner?**
A: Oui! Les codes restent identiques, l'API reste compatible.

**Q: Puis-je supprimer un référentiel?**
A: Les référentiels sont "soft deleted" (désactivés). Cela évite les orphelins en base.

**Q: Comment gérer les permissions pour l'ajout/édition ?**
A: Les routes POST/PUT/DELETE nécessitent la permission `admin`.
