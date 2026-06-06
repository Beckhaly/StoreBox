#!/bin/bash
# Test script for refactored routes using stored procedures

set -e

API_URL="http://localhost:3001"
TEST_RESULTS=()

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== StoreBox Routes Testing ===${NC}\n"

# Step 1: Health check
echo "1. Testing API health..."
HEALTH=$(curl -s "$API_URL/api/health")
if echo "$HEALTH" | grep -q "healthy\|ok"; then
  echo -e "${GREEN}✓ API is running${NC}"
else
  echo -e "${RED}✗ API not responding${NC}"
  exit 1
fi

# Step 2: Login
echo -e "\n2. Testing authentication (sp_auth_login)..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@telepro.ci","password":"TelePro2026!"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$TOKEN" ] && [ ${#TOKEN} -gt 50 ]; then
  echo -e "${GREEN}✓ Login successful${NC}"
  echo "  Token: ${TOKEN:0:30}..."
else
  echo -e "${RED}✗ Login failed${NC}"
  echo "  Response: $(echo "$LOGIN_RESPONSE" | head -c 200)"
  exit 1
fi

# Step 3: Test each refactored route
echo -e "\n${BLUE}=== Testing Refactored Routes ===${NC}\n"

# Clients route (sp_clients_list)
echo "3. Testing GET /api/clients (sp_clients_list)..."
CLIENTS=$(curl -s "$API_URL/api/clients" \
  -H "Authorization: Bearer $TOKEN")
if echo "$CLIENTS" | grep -q "success\|raison_sociale\|\[\]"; then
  echo -e "${GREEN}✓ sp_clients_list working${NC}"
else
  echo -e "${RED}✗ sp_clients_list failed${NC}"
  echo "  Response: $(echo "$CLIENTS" | head -c 200)"
fi

# Ventes route (sp_ventes_list)
echo -e "\n4. Testing GET /api/ventes (sp_ventes_list)..."
VENTES=$(curl -s "$API_URL/api/ventes" \
  -H "Authorization: Bearer $TOKEN")
if echo "$VENTES" | grep -q "success\|numero\|\[\]"; then
  echo -e "${GREEN}✓ sp_ventes_list working${NC}"
else
  echo -e "${RED}✗ sp_ventes_list failed${NC}"
  echo "  Response: $(echo "$VENTES" | head -c 200)"
fi

# Créances route (sp_creances_list, sp_creances_ageing)
echo -e "\n5. Testing GET /api/creances (sp_creances_list)..."
CREANCES=$(curl -s "$API_URL/api/creances" \
  -H "Authorization: Bearer $TOKEN")
if echo "$CREANCES" | grep -q "success\|creances\|\[\]"; then
  echo -e "${GREEN}✓ sp_creances_list working${NC}"
else
  echo -e "${RED}✗ sp_creances_list failed${NC}"
  echo "  Response: $(echo "$CREANCES" | head -c 200)"
fi

# Produits route (sp_produits_list)
echo -e "\n6. Testing GET /api/produits (sp_produits_list)..."
PRODUITS=$(curl -s "$API_URL/api/produits" \
  -H "Authorization: Bearer $TOKEN")
if echo "$PRODUITS" | grep -q "success\|nom\|\[\]"; then
  echo -e "${GREEN}✓ sp_produits_list working${NC}"
else
  echo -e "${RED}✗ sp_produits_list failed${NC}"
  echo "  Response: $(echo "$PRODUITS" | head -c 200)"
fi

# Dashboard route (sp_dashboard_kpis)
echo -e "\n7. Testing GET /api/dashboard (sp_dashboard_kpis)..."
DASHBOARD=$(curl -s "$API_URL/api/dashboard" \
  -H "Authorization: Bearer $TOKEN")
if echo "$DASHBOARD" | grep -q "success\|ca_jour\|ca_mois"; then
  echo -e "${GREEN}✓ sp_dashboard_kpis working${NC}"
else
  echo -e "${RED}✗ sp_dashboard_kpis failed${NC}"
  echo "  Response: $(echo "$DASHBOARD" | head -c 200)"
fi

echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}All critical stored procedures tested${NC}"
echo ""
echo "Next steps:"
echo "1. Verify all endpoints return expected data structures"
echo "2. Test POST/PUT/DELETE operations"
echo "3. Verify pagination and filtering works"
echo "4. Check error handling (404, 400, etc.)"
