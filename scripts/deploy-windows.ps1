<#
.SYNOPSIS
  Déploiement StoreBox sur Windows Server (sans Docker).
  Build + copie pdf-impl + migrations + (re)démarrage du service Windows.

.DESCRIPTION
  À lancer depuis une invite PowerShell Administrateur, sur le serveur,
  après avoir installé Node 20, PostgreSQL, NSSM et configuré
  apps\api\.env (au moins DATABASE_URL, JWT_SECRET, PORT).

.PARAMETER Install
  Crée le service Windows (NSSM) la première fois.

.PARAMETER SkipBuild
  Saute npm ci / npm run build (utile si déjà buildé).

.EXAMPLE
  # 1re fois (crée le service) :
  .\scripts\deploy-windows.ps1 -Install

.EXAMPLE
  # Mises à jour suivantes :
  .\scripts\deploy-windows.ps1
#>
[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$SkipBuild,
    [string]$ServiceName = 'StoreBox',
    [string]$NodeExe     = "$env:ProgramFiles\nodejs\node.exe"
)

$ErrorActionPreference = 'Stop'

# Racine du projet = dossier parent de \scripts
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
Write-Host "PROJET : $Root" -ForegroundColor Cyan

# ── 1. Build ──────────────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host "[1/5] npm ci" -ForegroundColor Cyan
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci a echoue" }

    Write-Host "[2/5] npm run build" -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build a echoue" }
}

# ── 2. pdf-impl.js (tsc ne le copie pas) ──────────────────────────
$src = Join-Path $Root 'apps\api\src\services\pdf-impl.js'
$dst = Join-Path $Root 'apps\api\dist\services\pdf-impl.js'
Copy-Item $src $dst -Force
Write-Host "[3/5] pdf-impl.js copie -> dist\services" -ForegroundColor Green

# ── 3. DATABASE_URL depuis apps\api\.env ──────────────────────────
$envFile = Join-Path $Root 'apps\api\.env'
if (-not (Test-Path $envFile)) {
    throw "Fichier $envFile manquant. Copier apps\api\.env.example et le configurer."
}
$match = Select-String -Path $envFile -Pattern '^\s*DATABASE_URL\s*=\s*(.+)$' | Select-Object -First 1
if (-not $match) { throw "DATABASE_URL absent de $envFile" }
$env:DATABASE_URL = $match.Matches[0].Groups[1].Value.Trim().Trim('"')
Write-Host "[4/5] DATABASE_URL charge depuis .env" -ForegroundColor Green

# ── 4. Migrations 001 -> 023 ──────────────────────────────────────
Write-Host "[5/5] Migrations" -ForegroundColor Cyan
node scripts\run-migrations.mjs
if ($LASTEXITCODE -ne 0) { throw "Les migrations ont echoue" }

# ── 5. Service Windows (NSSM) ─────────────────────────────────────
$apiDir  = Join-Path $Root 'apps\api'
$logsDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

function Test-Service { param($n) [bool](Get-Service -Name $n -ErrorAction SilentlyContinue) }

if ($Install) {
    if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
        throw "NSSM introuvable. Installer : winget install NSSM.NSSM"
    }
    if (Test-Service $ServiceName) {
        Write-Host "Service '$ServiceName' deja present." -ForegroundColor Yellow
    } else {
        nssm install $ServiceName "$NodeExe" "dist\index.js"
        nssm set $ServiceName AppDirectory "$apiDir"          # cwd => lit apps\api\.env
        nssm set $ServiceName AppStdout (Join-Path $logsDir 'api.log')
        nssm set $ServiceName AppStderr (Join-Path $logsDir 'api-err.log')
        nssm set $ServiceName Start SERVICE_AUTO_START
        Write-Host "Service '$ServiceName' cree (demarrage auto)." -ForegroundColor Green
    }
}

# ── 6. (Re)demarrage ──────────────────────────────────────────────
if (Test-Service $ServiceName) {
    Restart-Service $ServiceName
    Write-Host "Service '$ServiceName' (re)demarre." -ForegroundColor Green
} else {
    Write-Host "Service '$ServiceName' absent. Relancer avec -Install pour le creer." -ForegroundColor Yellow
}

Write-Host "`nDeploiement termine." -ForegroundColor Green
