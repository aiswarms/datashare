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

```bash
git clone git@github.com:aiswarms/datashare.git
cd datashare
chmod +x deploy.sh
./deploy.sh
```

Le script `deploy.sh` gère tout : détection première installation / mise à jour, collecte des secrets, migrations, build frontend, et smoke test final.

- **Première installation** : seuls `JWT_PASSPHRASE` et `S3_SECRET_KEY` sont demandés (saisie masquée). Toutes les autres variables ont une valeur par défaut fonctionnelle pour Docker local.
- **Mise à jour** : aucune saisie requise si `api/.env.local` existe déjà.

> Pour une utilisation en CI/CD, injectez les secrets via des variables d'environnement avant d'appeler le script. Voir [MAINTENANCE.md](MAINTENANCE.md#6-procédure-de-déploiement) pour le détail complet.

### Accéder à l'application

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
├── deploy.sh         # Script de déploiement (première install + mise à jour)
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
