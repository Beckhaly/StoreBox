# StoreBox — Installation d'un nouveau client (clé-en-main)

Tu as **une image** + ce dossier `deploy/`. Sur le serveur du client :

## Côté toi (une fois, pour produire l'image)
```bash
./scripts/release-image.sh 1.0.0
# → produit storebox-1.0.0.tar.gz  (l'image livrable)
```

## Côté serveur client (3 étapes)
1. **Copier** `storebox-1.0.0.tar.gz` + le dossier `deploy/` sur le serveur
   (le serveur doit avoir Docker : `curl -fsSL https://get.docker.com | sh`).

2. **Configurer** — éditer `deploy/.env` :
   ```
   DOMAIN=boutique-client.com        # DNS A déjà pointé vers le serveur
   POSTGRES_PASSWORD=                 # laisser vide → généré
   JWT_SECRET=                        # laisser vide → généré
   ```

3. **Installer** :
   ```bash
   cd deploy && ./install.sh
   ```
   → charge l'image, génère les secrets, démarre l'app + HTTPS automatique.

**C'est fini** : `https://boutique-client.com` est en ligne.

---

### Première connexion
- `admin@storebox.app` / `Storebox@123`
- Changer le mot de passe, créer les utilisateurs, et renseigner la
  **société** (nom, logo, adresse) directement dans l'application.
  → Une seule image sert tous les clients ; la personnalisation se fait
  dans l'app (en base), pas dans l'image.

### Exploitation
| Action | Commande (dans `deploy/`) |
|---|---|
| Logs | `docker compose logs -f` |
| Redémarrer | `docker compose restart` |
| Sauvegarde | `docker exec storebox pg_dump -U storebox storebox_ci > backup.sql` |
| Mettre à jour | charger la nouvelle image puis `docker compose up -d` |

Les données du client persistent dans le volume Docker `deploy_data`
(survivent aux redémarrages et mises à jour de l'image).

### Prérequis serveur
- 1 vCPU / 1–2 Go RAM suffisent pour un client.
- Ports 80 et 443 ouverts ; un domaine avec DNS A → IP du serveur.
