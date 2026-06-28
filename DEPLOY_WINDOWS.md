# Déploiement StoreBox sur Windows Server (sans Docker)

Déploiement « natif » : **Node (service Windows)** + **PostgreSQL (service Windows)**
+ **Caddy (HTTPS)**. L'API Express sert aussi le SPA React — pas de serveur web séparé.

```
[Caddy]  →  [Node API — service NSSM]  →  [PostgreSQL]
HTTPS        sert l'API + le SPA            base de données
:443                  :3001                      :5432
```

---

## 1. Prérequis (une fois)
```powershell
winget install OpenJS.NodeJS.LTS           # Node 20
winget install PostgreSQL.PostgreSQL.16    # PostgreSQL (service auto-démarré)
winget install NSSM.NSSM                    # gestionnaire de service
winget install Git.Git                      # optionnel
winget install CaddyServer.Caddy            # reverse-proxy HTTPS (ou IIS, voir plus bas)
```

## 2. Récupérer le code
```powershell
git clone <repo> C:\storebox
cd C:\storebox
```

## 3. Créer la base de données
```powershell
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
& $psql -U postgres -c "CREATE USER storebox WITH PASSWORD 'MotDePasseFort';"
& $psql -U postgres -c "CREATE DATABASE storebox_ci OWNER storebox;"
```

## 4. Configurer `apps\api\.env`
```ini
DATABASE_URL=postgresql://storebox:MotDePasseFort@localhost:5432/storebox_ci
JWT_SECRET=<64+ caracteres>
JWT_EXPIRES=8h
PORT=3001
NODE_ENV=production
```
> Générer un secret : `-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })`

## 5. Déployer (build + migrations + service) — **script automatisé**
Dans une **invite PowerShell Administrateur** :
```powershell
cd C:\storebox
# 1re fois (crée le service Windows) :
.\scripts\deploy-windows.ps1 -Install
```
Le script enchaîne : `npm ci` → `npm run build` → copie de `pdf-impl.js`
→ migrations `001 → 023` → création/démarrage du service `StoreBox`.

L'API tourne alors sur `localhost:3001` et **redémarre automatiquement** au boot.

## 6. HTTPS — Caddy
Créer `C:\caddy\Caddyfile` :
```
boutique-client.com {
    reverse_proxy localhost:3001
}
```
Lancer Caddy comme service (HTTPS Let's Encrypt automatique) :
```powershell
nssm install Caddy "C:\Program Files\Caddy\caddy.exe" "run --config C:\caddy\Caddyfile"
nssm start Caddy
```

## 7. Pare-feu
```powershell
New-NetFirewallRule -DisplayName "HTTP"  -Direction Inbound -LocalPort 80  -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

→ `https://boutique-client.com` est en ligne. 🎉
Connexion initiale : `admin@storebox.app` / `Storebox@123` (à changer dans l'app).

---

## Mises à jour
```powershell
cd C:\storebox
git pull
.\scripts\deploy-windows.ps1        # build + migrations + redémarrage du service
```

## Exploitation
| Action | Commande |
|---|---|
| État du service | `Get-Service StoreBox` |
| Logs | `Get-Content C:\storebox\logs\api.log -Tail 50 -Wait` |
| Redémarrer | `Restart-Service StoreBox` |
| Sauvegarde DB | `& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U storebox storebox_ci > backup.sql` |

---

## Variante « tout Microsoft » (au lieu de Caddy)
**IIS** + **ARR** (Application Request Routing) + **URL Rewrite** en reverse-proxy
vers `localhost:3001`, et **win-acme** (`wacs.exe`) pour le certificat Let's Encrypt.
Plus d'étapes, mais 100 % natif IIS.

## Pièges Windows (déjà gérés par le script)
1. **`pdf-impl.js`** : `tsc` ne le copie pas → le script le copie dans `dist\services\`.
2. **`DATABASE_URL`** doit être dans l'environnement pour les migrations → le script
   le lit depuis `apps\api\.env`.
3. **NSSM `AppDirectory = apps\api`** : indispensable pour que l'API trouve son `.env`.
4. **bcrypt** : binaires précompilés Windows (pas de compilation). Si échec rare :
   installer « Visual Studio Build Tools » (charge C++).
5. **Admin** : la création/(re)démarrage de service nécessite PowerShell **Administrateur**.

---

## Conteneur vs natif Windows
| | Docker (image) | Natif Windows |
|---|---|---|
| Installation | 1 commande | plusieurs étapes (script fourni) |
| Reproductibilité | ⭐⭐⭐ | ⭐⭐ (dépend des versions installées) |
| Sur Windows Server | nécessite WSL2/Hyper-V (Linux) | **direct, sans couche Linux** |
| Mises à jour | `docker load` + `up -d` | `git pull` + `deploy-windows.ps1` |

Sur **Windows Server**, le déploiement natif évite la couche Linux (WSL2/Hyper-V)
qu'imposerait l'image Docker — c'est souvent le choix le plus simple ici.
