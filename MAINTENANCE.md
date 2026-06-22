# MAINTENANCE.md — Procédures de maintenance DataShare

## 1. Mises à jour des dépendances

### Fréquence recommandée

| Type | Fréquence | Outil |
|------|-----------|-------|
| Sécurité (patch critique) | Immédiat dès publication | `npm audit`, `composer audit` |
| Patch mineur (bug fix) | Mensuel | — |
| Minor (nouvelles fonctionnalités) | Trimestriel | — |
| Major (breaking change) | Sur décision équipe | — |

### Procédure

#### Frontend (npm)

```bash
cd frontend

# Vérifier les vulnérabilités
npm audit

# Corriger automatiquement les patchs sécurité
npm audit fix

# Voir les mises à jour disponibles
npx npm-check-updates

# Mettre à jour les dépendances mineures
npx npm-check-updates -u --target minor
npm install

# Valider
npm test
npm run build
```

#### Backend (Composer)

```bash
cd api

# Vérifier les vulnérabilités
composer audit

# Mettre à jour les dépendances
composer update --with-all-dependencies

# Valider
php vendor/bin/phpunit
```

### Risques à surveiller

- **Symfony** (major) : migrations de configuration, changements d'API des bundles
- **lexik/jwt-authentication-bundle** : incompatibilités JWT sur major
- **React** (major) : breaking changes sur les hooks et le rendu
- **react-router-dom** : changements d'API de routing

---

## 2. Procédure de correction de bug

### Workflow

```
1. Ouvrir une issue avec : description, étapes de reproduction, comportement attendu
2. Créer une branche : git checkout -b fix/<description-courte>
3. Reproduire le bug avec un test
4. Corriger le code
5. Vérifier que tous les tests passent : npm test + php vendor/bin/phpunit
6. Créer une Pull Request vers main
7. Review + merge
8. Déployer (voir section 6)
```

### Branches

| Type | Format | Exemple |
|------|--------|---------|
| Bug fix | `fix/<description>` | `fix/download-password-401` |
| Feature | `feat/<description>` | `feat/email-notification` |
| Hotfix prod | `hotfix/<description>` | `hotfix/upload-crash` |

---

## 3. Rotation des secrets JWT

La clé privée JWT et son passphrase doivent être renouvelés périodiquement ou immédiatement en cas de compromission.

### Procédure

```bash
cd api

# 1. Générer une nouvelle paire de clés
php bin/console lexik:jwt:generate-keypair --overwrite

# 2. Mettre à jour JWT_PASSPHRASE dans les variables d'environnement
#    (ne jamais commiter dans le dépôt)

# 3. Redémarrer l'API
docker compose restart api

# 4. Impact : tous les tokens JWT existants sont invalidés.
#    Les utilisateurs devront se reconnecter.
```

**Fréquence recommandée** : tous les 90 jours en production, ou immédiatement si compromission suspectée.

---

## 4. Sauvegarde et restauration

### PostgreSQL

```bash
# Sauvegarde
docker compose exec db pg_dump -U datashare datashare > backup_$(date +%Y%m%d).sql

# Restauration
docker compose exec -T db psql -U datashare datashare < backup_20260614.sql
```

**Fréquence recommandée** : quotidienne, rétention 30 jours.

### MinIO (fichiers uploadés)

```bash
# Installer mc (MinIO Client)
brew install minio/stable/mc

# Configurer
mc alias set local http://localhost:9000 datashare datashare

# Sauvegarde du bucket
mc mirror local/datashare /backups/minio/$(date +%Y%m%d)/

# Restauration
mc mirror /backups/minio/20260614/ local/datashare
```

**Fr��quence recommandée** : quotidienne, synchronisée avec la sauvegarde BDD.

---

## 5. Surveillance et alertes

### Logs

```bash
# Logs en temps réel (tous les services)
docker compose logs -f

# Logs API uniquement
docker compose logs -f api

# Erreurs des dernières 24h
docker compose logs api --since 24h | grep '"level":"ERROR"'
```

### Métriques à surveiller

| Métrique | Outil | Seuil d'alerte |
|----------|-------|----------------|
| Disponibilité `/api/health` | Uptime monitor | < 99.9% |
| Espace disque MinIO | `df -h` | > 80% |
| Connexions BDD actives | PostgreSQL `pg_stat_activity` | > 80 connexions |
| Taille des logs | `du -sh api/var/log/` | > 1 GB |
| Erreurs 5xx | Nginx access log | > 1% des requêtes |

### Health check

```bash
curl -f http://localhost/api/health
# Réponse attendue : {"status":"ok"}
```

---

## 6. Procédure de déploiement

### Environnement local (développement)

```bash
# Première installation
git clone <repo>
cd datashare
cp api/.env api/.env.local   # adapter les variables

docker compose up -d
docker compose exec api php bin/console doctrine:migrations:migrate --no-interaction
```

### Mise à jour (patch/minor)

```bash
git pull origin main

# Backend
docker compose exec api composer install --no-dev --optimize-autoloader
docker compose exec api php bin/console doctrine:migrations:migrate --no-interaction
docker compose exec api php bin/console cache:clear

# Frontend
docker compose exec frontend npm ci
docker compose exec frontend npm run build

# Redémarrer
docker compose restart api frontend nginx
```

### Variables d'environnement requises

| Variable | Description | Où définir |
|----------|-------------|-----------|
| `APP_SECRET` | Secret Symfony | `.env.local` |
| `DATABASE_URL` | URL PostgreSQL | `.env.local` |
| `JWT_PASSPHRASE` | Passphrase clé JWT | Secret manager / CI |
| `S3_ENDPOINT` | URL MinIO / S3 | `.env.local` |
| `S3_ACCESS_KEY` | Clé d'accès MinIO / S3 | `.env.local` |
| `S3_SECRET_KEY` | Clé secrète MinIO / S3 | Secret manager / CI |
| `S3_REGION` | Région S3 | `.env.local` |
| `S3_BUCKET` | Nom du bucket | `.env.local` |

### Rollback

```bash
# Retourner au commit précédent
git revert HEAD
git push origin main

# Ou rollback migration Doctrine
docker compose exec api php bin/console doctrine:migrations:migrate prev
```
