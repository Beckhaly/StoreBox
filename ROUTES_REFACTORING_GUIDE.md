# StoreBox — Routes Refactoring Guide

**Status**: 🚀 In Progress (7/50+ routes refactored)

## Overview

Migration of Express routes from direct SQL queries to PostgreSQL stored procedures.

**Pattern**: 
```
❌ BEFORE: Route → SQL query → PostgreSQL
✅ AFTER:  Route → callSP() helper → PostgreSQL stored procedure
```

---

## Refactored Routes (7 Complete)

| Module | Status | File | Key Endpoints |
|--------|--------|------|---|
| **Ventes** | ✅ Done | `ventes-refactored.ts` | GET /, GET /:id, POST /, POST /:id/paiement, DELETE /:id, PUT /:id, GET /stats/ca-mois |
| **Clients** | ✅ Done | `clients-refactored.ts` | GET /, GET /:id, POST /, PUT /:id, DELETE /:id, GET /:id/stats |
| **Créances** | ✅ Done | `creances-refactored.ts` | GET /, GET /ageing/summary, GET /:vente_id, POST /:vente_id/paiement, GET /rapport/* |
| **Produits** | ✅ Done | `produits-refactored.ts` | GET /, GET /:id, POST /, PUT /:id, DELETE /:id |
| **Fournisseurs** | ✅ Done | `fournisseurs-refactored.ts` | GET /, GET /:id, POST /, PUT /:id, DELETE /:id |
| **Achats** | ✅ Done | `achats-refactored.ts` | GET /, GET /:id, POST /, POST /:id/paiement, DELETE /:id |
| **Stock** | ✅ Done | `stock-refactored.ts` | GET /, GET /:produit_id, POST /mouvements, POST /ajustement, POST /transfert |

---

## Implementation Pattern

### Step 1: Create Stored Procedures

For each route, identify all SQL queries and create corresponding SP:

```sql
-- Example: sp_clients_get
CREATE OR REPLACE FUNCTION sp_clients_get(p_id INT)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY SELECT * FROM clients WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Add Helper Functions

Update `lib/sp.ts` with type-safe helpers:

```typescript
export async function spClientsGet(id: number) {
  return callSPScalar('sp_clients_get', { p_id: id });
}
```

### Step 3: Refactor Routes

Replace `db.query()` with SP helpers:

```typescript
// ❌ BEFORE
const { rows } = await db.query('SELECT * FROM clients WHERE id = $1', [id]);

// ✅ AFTER
const client = await callSPScalar('sp_clients_get', { p_id: id });
```

### Step 4: Swap Routes

```bash
mv apps/api/src/routes/module.ts apps/api/src/routes/module-old.ts
mv apps/api/src/routes/module-refactored.ts apps/api/src/routes/module.ts
```

---

## Remaining Routes (43 to refactor)

### HIGH PRIORITY

These are used frequently and should be done next:

- **Dashboard** (dashboard KPIs, summaries)
- **Rapports** (reports, rentabilité, trésorerie)
- **Paiements** (payment tracking)
- **Dépenses** (expense management)
- **Utilisateurs** (user admin)
- **Sessions** (auth sessions)

### MEDIUM PRIORITY

- Devis (quotations)
- Retours (returns)
- Bons Commande (purchase orders)
- Écheances (payment schedules)
- Dettes (supplier debt)

### LOW PRIORITY (Maintenance)

- Referentiels (reference data)
- Audit logs
- Notifications
- Search/export functions

---

## Missing Stored Procedures (To Create)

### Produits
- [ ] `sp_produits_update`
- [ ] `sp_produits_delete`
- [ ] `sp_produits_search`

### Fournisseurs
- [ ] `sp_fournisseurs_create`
- [ ] `sp_fournisseurs_update`
- [ ] `sp_fournisseurs_delete`

### Achats
- [ ] `sp_achats_create_complete` (with lignes)
- [ ] `sp_achats_lignes_list`
- [ ] `sp_achats_paiement_add`
- [ ] `sp_achats_cancel`

### Stock
- [ ] `sp_stocks_mouvements_create`
- [ ] `sp_stocks_mouvements_list`
- [ ] `sp_stocks_ajustement`
- [ ] `sp_stocks_transfert`

### Dashboard & Rapports
- [ ] `sp_rapports_rentabilite`
- [ ] `sp_rapports_tresorerie`
- [ ] `sp_rapports_commercial`
- [ ] `sp_rapports_performance`

### Admin
- [ ] `sp_utilisateurs_list`
- [ ] `sp_utilisateurs_create`
- [ ] `sp_utilisateurs_update`
- [ ] `sp_utilisateurs_delete`
- [ ] `sp_roles_list`
- [ ] `sp_audit_logs_list`

### Other
- [ ] `sp_devis_list`, `sp_devis_create`
- [ ] `sp_retours_list`, `sp_retours_create`
- [ ] `sp_bons_commande_list`, `sp_bons_commande_create`
- [ ] `sp_echeances_list`
- [ ] `sp_dettes_list`, `sp_dettes_paiement_add`

---

## Quick Start Checklist

### To Complete a Route Module:

```
[ ] Read original route file (e.g., routes/module.ts)
[ ] Identify all db.query() calls
[ ] Create corresponding stored procedures in migrations/015_stored_procedures.sql
[ ] Add helper functions to lib/sp.ts
[ ] Create routes/module-refactored.ts using the pattern
[ ] Test with: npm run dev
[ ] Verify endpoints work with stored procedures
[ ] Swap: mv routes/module-refactored.ts routes/module.ts
[ ] Test again to confirm no regressions
[ ] Remove module-old.ts backup
```

---

## Testing Stored Procedures

### Direct SQL Test
```bash
psql $DATABASE_URL -c "SELECT * FROM sp_clients_list() LIMIT 5;"
```

### Via API (with token)
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@telepro.ci","password":"TelePro2026!"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

curl -s http://localhost:3001/api/clients \
  -H "Authorization: Bearer $TOKEN"
```

---

## Architecture Benefits

✅ **Security** — No SQL injection possible (all queries in stored procedures)  
✅ **Performance** — PostgreSQL optimizes complex queries at creation time  
✅ **Maintainability** — Business logic centralized in database layer  
✅ **Scalability** — Complex aggregations/reports handled by database  
✅ **Testability** — SP can be tested independently of routes  

---

## Timeline Estimate

- **Easy modules** (Produits, Fournisseurs, Stock): 1-2 hours each
- **Medium modules** (Rapports, Paiements, Dépenses): 2-3 hours each
- **Complex modules** (Dashboard, Admin, Devis): 3-4 hours each

**Total**: ~40-50 hours for full refactoring of 50+ routes

---

## Notes

- Always test routes AFTER refactoring with real data
- Check for any custom SQL logic not visible in route files
- Some routes may need refactoring in multiple smaller SP
- Consider performance implications for large result sets
- Add pagination parameters to LIST operations

