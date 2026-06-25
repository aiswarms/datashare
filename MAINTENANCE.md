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

Le script `deploy.sh` à la racine du projet automatise l'intégralité du déploiement.
Il détecte automatiquement si c'est une première installation ou une mise à jour.

```bash
chmod +x deploy.sh
./deploy.sh
```

### Première installation

Si `api/.env.local` est absent, le script entre en mode **première installation** :

1. `APP_SECRET` est généré automatiquement (`openssl rand -hex 32`).
2. Les variables avec une valeur par défaut locale (DATABASE_URL, S3_ENDPOINT, etc.) sont appliquées silencieusement.
3. Seuls `JWT_PASSPHRASE` et `S3_SECRET_KEY` sont demandés interactivement (saisie masquée).
4. `api/.env.local` est écrit par le script — aucune édition manuelle requise.

### Mise à jour

Si `api/.env.local` existe déjà, aucune question n'est posée. Le script enchaîne :

1. `git pull origin main`
2. `docker compose up -d --build`
3. Attente PostgreSQL (`pg_isready`)
4. `composer install --no-dev`
5. Migrations Doctrine
6. Génération des clés JWT si absentes
7. `cache:clear --env=prod`
8. `npm ci` + `npm run build`
9. `docker compose restart api frontend nginx`
10. Smoke test sur `GET /api/health`

Le script s'arrête immédiatement (`set -e`) à la première erreur.

### Utilisation en CI/CD

Les secrets peuvent être injectés via des variables d'environnement avant d'appeler le script — aucun prompt ne sera affiché :

```bash
export JWT_PASSPHRASE="$SECRET_JWT_PASSPHRASE"
export S3_SECRET_KEY="$SECRET_S3_KEY"
./deploy.sh
```

### Variables d'environnement

| Variable | Requis | Valeur par défaut (Docker local) | Sensible |
|----------|--------|----------------------------------|---------|
| `APP_SECRET` | Oui | Généré automatiquement | — |
| `DATABASE_URL` | Oui | `postgresql://datashare:datashare@db:5432/datashare` | — |
| `JWT_PASSPHRASE` | Oui | *(prompt)* | Oui |
| `S3_ENDPOINT` | Oui | `http://minio:9000` | — |
| `S3_ACCESS_KEY` | Oui | `datashare` | — |
| `S3_SECRET_KEY` | Oui | *(prompt)* | Oui |
| `S3_REGION` | Oui | `us-east-1` | — |
| `S3_BUCKET` | Oui | `datashare` | — |

### Rollback

```bash
# Rollback migration Doctrine
docker compose exec api php bin/console doctrine:migrations:migrate prev

# Ou retour au commit précédent
git revert HEAD
git push origin main
```
