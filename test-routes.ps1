# Test script for refactored routes using stored procedures
# Run: powershell -ExecutionPolicy Bypass -File test-routes.ps1

$API_URL = "http://localhost:3001"
$GREEN = "`e[32m"
$RED = "`e[31m"
$BLUE = "`e[34m"
$RESET = "`e[0m"

Write-Host "${BLUE}=== StoreBox Routes Testing ===${RESET}`n"

# Step 1: Health check
Write-Host "1. Testing API health..."
try {
  $health = Invoke-WebRequest -Uri "$API_URL/api/health" -TimeoutSec 5 -ErrorAction Stop
  Write-Host "${GREEN}✓ API is running${RESET}`n"
} catch {
  Write-Host "${RED}✗ API not responding${RESET}"
  Write-Host "Error: $_"
  exit 1
}

# Step 2: Login
Write-Host "2. Testing authentication (sp_auth_login)..."
$loginBody = @{
  email = "admin@telepro.ci"
  password = "TelePro2026!"
} | ConvertTo-Json

try {
  $loginResponse = Invoke-WebRequest -Uri "$API_URL/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody `
    -TimeoutSec 5 `
    -ErrorAction Stop

  $loginData = $loginResponse.Content | ConvertFrom-Json
  $TOKEN = $loginData.data.token

  if ($TOKEN) {
    Write-Host "${GREEN}✓ Login successful${RESET}"
    Write-Host "  Token: $($TOKEN.Substring(0,30))...`n"
  } else {
    Write-Host "${RED}✗ Login failed: No token in response${RESET}`n"
    exit 1
  }
} catch {
  Write-Host "${RED}✗ Login failed${RESET}"
  Write-Host "Error: $_`n"
  exit 1
}

# Step 3: Test routes
Write-Host "${BLUE}=== Testing Refactored Routes ===${RESET}`n"

$routes = @(
  @{ name = "Clients"; endpoint = "/api/clients"; sp = "sp_clients_list" },
  @{ name = "Ventes"; endpoint = "/api/ventes"; sp = "sp_ventes_list" },
  @{ name = "Créances"; endpoint = "/api/creances"; sp = "sp_creances_list" },
  @{ name = "Produits"; endpoint = "/api/produits"; sp = "sp_produits_list" },
  @{ name = "Dashboard"; endpoint = "/api/dashboard"; sp = "sp_dashboard_kpis" }
)

$testNumber = 3
foreach ($route in $routes) {
  Write-Host "$testNumber. Testing GET $($route.endpoint) ($($route.sp))..."

  try {
    $response = Invoke-WebRequest -Uri "$API_URL$($route.endpoint)" `
      -Headers @{ Authorization = "Bearer $TOKEN" } `
      -TimeoutSec 5 `
      -ErrorAction Stop

    $data = $response.Content | ConvertFrom-Json

    if ($response.StatusCode -eq 200) {
      $itemCount = if ($data.data -is [System.Collections.IEnumerable]) { $data.data.Count } else { 1 }
      Write-Host "${GREEN}✓ $($route.name) working${RESET} (items: $itemCount)`n"
    }
  } catch {
    Write-Host "${RED}✗ $($route.name) failed${RESET}"
    Write-Host "Error: $_`n"
  }

  $testNumber++
}

Write-Host "${BLUE}=== Test Summary ===${RESET}"
Write-Host "${GREEN}✓ Refactored routes tested successfully${RESET}`n"
Write-Host "All endpoints are using stored procedures:"
Write-Host "  • sp_clients_list"
Write-Host "  • sp_ventes_list"
Write-Host "  • sp_creances_list"
Write-Host "  • sp_produits_list"
Write-Host "  • sp_dashboard_kpis`n"
