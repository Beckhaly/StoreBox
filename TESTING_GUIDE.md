# Local Testing Guide — Refactored Routes

## Prerequisites

✅ Docker Desktop running and daemon responding  
✅ PostgreSQL container healthy on port 5432  
✅ API dev server running on port 3001  

---

## Quick Start (5 minutes)

### 1. Verify Docker is Working

```powershell
docker ps
# Should show: CONTAINER ID  IMAGE  STATUS
# telepro-postgres should be UP
```

If Docker fails, restart it:
```powershell
# Kill all Docker processes
Get-Process | Where-Object Name -match docker | Stop-Process -Force

# Wait 10 seconds, then restart
Start-Sleep -Seconds 10
& "Docker Desktop"  # Or open Docker Desktop from Start Menu

# Wait 30-60 seconds for daemon to initialize
docker ps  # Should work now
```

---

### 2. Start the API Server

```bash
cd C:\Projects\StoreBox
npm run dev -w apps/api
# Should show: 🚀 StoreBox API → http://localhost:3001
```

---

### 3. Run Tests

**Option A: PowerShell (Windows)**
```powershell
cd C:\Projects\StoreBox
powershell -ExecutionPolicy Bypass -File test-routes.ps1
```

**Option B: Bash/Shell**
```bash
cd /c/Projects/StoreBox
bash test-routes.sh
```

---

## What Gets Tested

| Route | Method | SP Called | Expected |
|-------|--------|-----------|----------|
| `/api/clients` | GET | `sp_clients_list()` | List of clients |
| `/api/ventes` | GET | `sp_ventes_list()` | List of sales |
| `/api/creances` | GET | `sp_creances_list()` | List of receivables |
| `/api/produits` | GET | `sp_produits_list()` | List of products |
| `/api/dashboard` | GET | `sp_dashboard_kpis()` | KPI metrics |

---

## Enable Refactored Routes (Swap Files)

To activate the refactored routes that use stored procedures:

```bash
# Backup originals (optional)
mv apps/api/src/routes/clients.ts apps/api/src/routes/clients-original.ts
mv apps/api/src/routes/ventes.ts apps/api/src/routes/ventes-original.ts
mv apps/api/src/routes/creances.ts apps/api/src/routes/creances-original.ts
mv apps/api/src/routes/produits.ts apps/api/src/routes/produits-original.ts
mv apps/api/src/routes/fournisseurs.ts apps/api/src/routes/fournisseurs-original.ts
mv apps/api/src/routes/achats.ts apps/api/src/routes/achats-original.ts
mv apps/api/src/routes/stock.ts apps/api/src/routes/stock-original.ts

# Activate refactored versions
cp apps/api/src/routes/clients-refactored.ts apps/api/src/routes/clients.ts
cp apps/api/src/routes/ventes-refactored.ts apps/api/src/routes/ventes.ts
cp apps/api/src/routes/creances-refactored.ts apps/api/src/routes/creances.ts
cp apps/api/src/routes/produits-refactored.ts apps/api/src/routes/produits.ts
cp apps/api/src/routes/fournisseurs-refactored.ts apps/api/src/routes/fournisseurs.ts
cp apps/api/src/routes/achats-refactored.ts apps/api/src/routes/achats.ts
cp apps/api/src/routes/stock-refactored.ts apps/api/src/routes/stock.ts

# Restart API server
npm run dev -w apps/api
```

---

## Manual Testing (Postman / cURL)

### 1. Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@telepro.ci","password":"TelePro2026!"}'

# Response includes: { "data": { "token": "eyJ..." } }
# Copy the token for next requests
```

### 2. Test Clients Route
```bash
TOKEN="your_token_here"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/clients

# Should return: { "success": true, "data": [...] }
```

### 3. Test Ventes Route
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/ventes

# Should return sales list using sp_ventes_list
```

### 4. Create a Client (Test POST)
```bash
curl -X POST http://localhost:3001/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CLI-001",
    "type_client": "grossiste",
    "raison_sociale": "Test Client SARL"
  }'

# Should use sp_clients_create
```

---

## Troubleshooting

### API won't start
- Check: Port 3001 not in use
- Check: DATABASE_URL in `.env` is correct
- Check: PostgreSQL container is running

### API starts but endpoints return 500
- Check: Stored procedures exist in database
- Check: API server has compiled without TypeScript errors
- Check: Database credentials in `.env` match Docker config

### Stored procedures not found
- Apply migration: `npm run db:migrate -w apps/api`
- Verify: `docker exec telepro-postgres psql -U telepro -d telepro_ci -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_name LIKE 'sp_%';"`
- Should return: `(1 row)` with count = 19 or more

### Docker daemon won't respond
1. Open Docker Desktop from Start Menu manually
2. Wait 30-60 seconds for daemon to initialize
3. Run: `docker ps` to verify connection
4. If still fails: Restart computer

---

## Database Migration Commands

```bash
# Apply all migrations including stored procedures
npm run db:setup -w apps/api

# Or just apply without seed:
npm run db:migrate -w apps/api

# Verify stored procedures exist
docker exec telepro-postgres psql -U telepro -d telepro_ci \
  -c "SELECT routine_name FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      ORDER BY routine_name LIMIT 30;"
```

---

## Expected Test Results ✅

All tests should show:
```
✓ API is running
✓ Login successful
✓ Clients working (items: N)
✓ Ventes working (items: N)
✓ Créances working (items: N)
✓ Produits working (items: N)
✓ Dashboard working
```

---

## Next Steps After Successful Test

1. ✅ Swap remaining refactored route files
2. ✅ Test each module's CRUD operations
3. ✅ Verify error handling (404, 400, etc.)
4. ✅ Check filtering and pagination
5. ✅ Create remaining stored procedures
6. ✅ Deploy to O2SWITCH

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| ECONNREFUSED on login | PostgreSQL container not running |
| 404 on /api/clients | Route not found - check imports in index.ts |
| Stored procedure not found | Run `npm run db:migrate` |
| TypeScript compilation error | Check lib/sp.ts syntax |
| Token invalid | Login again, token might be expired |

