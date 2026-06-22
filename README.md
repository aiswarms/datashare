# DataShare

Application web de partage de fichiers : upload authentifié ou anonyme, liens temporaires, protection par mot de passe, gestion des tags.

→ [Documentation technique complète](DOC_TECHNIQUE.md)

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Docker | 24+ |
| Docker Compose | 2.20+ |
| Git | 2.40+ |

---

## Installation

### 1. Cloner le dépôt

```bash
git clone git@github.com:aiswarms/datashare.git
cd datashare
```

### 2. Configurer les variables d'environnement

```bash
cp api/.env api/.env.local
```

Éditer `api/.env.local` avec vos valeurs :

| Variable | Description | Valeur par défaut (dev) |
|----------|-------------|------------------------|
| `APP_SECRET` | Secret Symfony (32 chars min) | *(à définir)* |
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgresql://datashare:datashare@db:5432/datashare?serverVersion=16` |
| `JWT_PASSPHRASE` | Passphrase de la clé privée JWT | `changeme` |
| `S3_ENDPOINT` | URL MinIO / S3 | `http://minio:9000` |
| `S3_ACCESS_KEY` | Clé d'accès S3 | `datashare` |
| `S3_SECRET_KEY` | Clé secrète S3 | `datashare` |
| `S3_REGION` | Région S3 | `us-east-1` |
| `S3_BUCKET` | Nom du bucket | `datashare` |

> En développement, les valeurs par défaut du `docker-compose.yml` sont fonctionnelles sans modification.

### 3. Démarrer la stack

```bash
docker compose up -d
```

L'API attend automatiquement que PostgreSQL soit prêt, puis exécute les migrations. Aucune action manuelle requise.

### 4. Générer les clés JWT

Au premier démarrage (si les clés n'existent pas encore) :

```bash
docker compose exec api php bin/console lexik:jwt:generate-keypair
```

### 5. Accéder à l'application

| Service | URL |
|---------|-----|
| Application | http://localhost |
| API (Swagger UI) | http://localhost/api/doc |
| MinIO Console | http://localhost:9001 |

Sur un volume vierge, créez votre premier compte via **http://localhost/register**.

---

## Commandes utiles

```bash
# Arrêter la stack
docker compose down

# Voir les logs de l'API
docker compose logs -f api

# Accéder au shell de l'API
docker compose exec api sh

# Créer une migration après modification des entités
docker compose exec api php bin/console doctrine:migrations:diff

# Appliquer les migrations manuellement
docker compose exec api php bin/console doctrine:migrations:migrate
```

---

## Tests

### Backend (PHPUnit)

```bash
docker compose exec api php vendor/bin/phpunit
```

### Frontend (Vitest)

```bash
cd frontend
npm install
npm test
```

### Couverture frontend

```bash
cd frontend && npm run coverage
# Rapport HTML → frontend/coverage/index.html
```

### Tests E2E Cypress (stack Docker requise)

```bash
cd frontend
npm run cy:run    # headless
npm run cy:open   # interface graphique
```

### Tests de charge k6

```bash
# Installer k6 : brew install k6
k6 run perf/k6-upload.js
k6 run perf/k6-download.js
```

---

## Structure du projet

```
datashare/
├── api/              # Back-end Symfony 8.1
├── frontend/         # Front-end React 19 / Vite
│   └── cypress/      # Tests E2E (26 scénarios)
├── nginx/            # Configuration reverse proxy
├── perf/             # Scripts k6
├── docker-compose.yml
├── DOC_TECHNIQUE.md  # Documentation technique complète
├── API_CONTRACT.md   # Référence de l'API REST
├── TESTING.md        # Plan de tests et couverture
├── SECURITY.md       # Rapport de scan de sécurité
├── PERF.md           # Tests de performance
└── MAINTENANCE.md    # Procédures de maintenance
```

---

## Plan de suivi de qualité et maintenance

| Document | Contenu |
|----------|---------|
| [TESTING.md](TESTING.md) | Plan de tests par US, résultats PHPUnit (85 tests) et Vitest (167 cas), couverture frontend, 26 scénarios Cypress |
| [SECURITY.md](SECURITY.md) | Scan de sécurité (`npm audit`, `trivy`), règles d'authentification, validation des entrées, recommandations production |
| [PERF.md](PERF.md) | Tests de charge k6, métriques Lighthouse, budget bundle, analyse des goulots d'étranglement |
| [MAINTENANCE.md](MAINTENANCE.md) | Mises à jour des dépendances, rotation des secrets JWT, sauvegardes, surveillance, procédure de déploiement |

---

## Licence

MIT
