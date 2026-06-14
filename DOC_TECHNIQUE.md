# Documentation technique — DataShare

---

## Table des matières

1. [Architecture de l'application](#1-architecture-de-lapplication)
2. [Choix technologiques justifiés](#2-choix-technologiques-justifiés)
3. [Modèle de données](#3-modèle-de-données)
4. [Documentation d'API](#4-documentation-dapi)
5. [Sécurité et gestion des accès](#5-sécurité-et-gestion-des-accès)
6. [Qualité, tests et maintenance](#6-qualité-tests-et-maintenance)
7. [Processus d'installation et d'exécution](#7-processus-dinstallation-et-dexécution)
8. [Utilisation de l'IA dans le développement](#8-utilisation-de-lia-dans-le-développement)

---

## 1. Architecture de l'application

### Vue globale

```
┌─────────────────────────────────────────────────────────────────┐
│                        Navigateur (HTTPS)                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP :80
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Nginx (reverse proxy)                     │
│   /           → frontend :5173                                   │
│   /api/*       → api :8000                                       │
└──────────┬──────────────────────────────────────┬───────────────┘
           │                                      │
           ▼                                      ▼
┌──────────────────────┐              ┌───────────────────────────┐
│  Frontend            │              │  API Backend              │
│  React 19 / Vite     │  REST JSON   │  PHP 8.4 / Symfony 8.1    │
│  TypeScript          │◄────────────►│  JWT Auth                 │
│  Chakra UI           │              │  Doctrine ORM             │
│  React Router v7     │              │  PHPUnit tests            │
└──────────────────────┘              └──────────┬────────────────┘
                                                 │
                        ┌────────────────────────┤
                        │                        │
                        ▼                        ▼
           ┌─────────────────────┐  ┌────────────────────────────┐
           │  PostgreSQL 16      │  │  MinIO (S3-compatible)      │
           │  Tables :           │  │  Bucket : datashare         │
           │  users / files /    │  │  Stockage binaire des       │
           │  tags               │  │  fichiers uploadés          │
           └─────────────────────┘  └────────────────────────────┘

           ┌─────────────────────────────────────────────────────┐
           │  Worker (conteneur séparé)                           │
           │  Cron toutes les 3600s                               │
           │  php bin/console app:purge-expired                   │
           └─────────────────────────────────────────────────────┘
```

### Flux de données principaux

| Flux | Description |
|------|-------------|
| Upload | Navigateur → Nginx → API → MinIO (fichier) + PostgreSQL (métadonnées) |
| Download | Navigateur → Nginx → API → MinIO (lecture stream) → Navigateur |
| Auth | Navigateur → Nginx → API → PostgreSQL → JWT signé RS256 |
| Purge | Worker → PostgreSQL (SELECT expires_at < NOW()) → MinIO (delete) |

### Légende
- `→` : appel HTTP / requête
- `◄────────────►` : échange bidirectionnel REST
- Tous les conteneurs communiquent via le réseau Docker interne (non exposé)
- Seul Nginx est exposé sur le port 80 côté hôte

---

## 2. Choix technologiques justifiés

### Tableau de synthèse

| Élément | Technologie choisie | Alternatives considérées | Justification |
|---------|--------------------|--------------------------|-|
| Langage back-end | PHP 8.4 | Java / Spring Boot, NestJS | Maîtrise du langage, écosystème Symfony mature pour les API REST |
| Framework back-end | Symfony 8.1 | Laravel, NestJS | Architecture structurée, injection de dépendances native, bundles JWT et Doctrine éprouvés |
| Langage front-end | TypeScript | JavaScript pur | Typage statique, détection d'erreurs à la compilation, meilleure maintenabilité |
| Framework front-end | React 19 | Vue 3, Angular | Composants fonctionnels simples, large écosystème, hooks natifs suffisants sans Redux |
| Base de données | PostgreSQL 16 | MySQL, MongoDB | Données relationnelles typées, contraintes d'intégrité (FK, UNIQUE, CHECK), transactions ACID |
| Stockage fichiers | MinIO (S3-compatible) | Système de fichiers local, AWS S3 | Compatible avec l'API AWS S3, auto-hébergeable, portabilité vers le cloud sans changer le code |
| Authentification | JWT RS256 (`lexik/jwt-authentication-bundle`) | Sessions PHP, OAuth2 | Stateless, adapté aux API REST, algorithme asymétrique RS256 |
| UI components | Chakra UI v3 | Material UI, Tailwind | Composants accessibles, thème cohérent, bonne intégration React |
| Reverse proxy | Nginx | Apache, Caddy | Performances élevées, configuration simple, `client_max_body_size` pour les uploads 1 Go |
| Conteneurisation | Docker / Docker Compose | Kubernetes | Environnement reproductible, stack complète en une commande |
| Tests back-end | PHPUnit 13 | Pest | Standard Symfony, intégration native avec le kernel de test |
| Tests front-end | Vitest 4 | Jest | Natif Vite, même syntaxe que Jest, execution plus rapide |
| Tests E2E | Cypress 15 | Playwright | Debugging visuel, API stable, bonne intégration avec les SPA |
| ORM | Doctrine ORM | Eloquent, PDO | Intégration native Symfony, migrations versionnées, entités PHP mappées |
| CI/CD | GitHub Actions | GitLab CI, Circle CI | Intégration GitHub native, gratuit pour les repos publics |
| Gestion dépendances back | Composer | — | Standard PHP |
| Gestion dépendances front | npm | yarn, pnpm | Standard Node.js, lock file déterministe |
| Versionning | Git (Conventional Commits) | — | Historique lisible, changelog automatisable |

### Détails des choix clés

**PHP / Symfony vs Java / NestJS**  
Symfony 8.1 offre un système de routing par attributs PHP, un container de services puissant et des bundles de qualité (JWT, Doctrine, Validator). La compatibilité avec PHP 8.4 (typage natif des propriétés, enum, fibers) rend le code aussi expressif que TypeScript côté back.

**PostgreSQL vs MongoDB**  
Le modèle de données est clairement relationnel (User → File → Tag). Les contraintes d'intégrité (`UNIQUE`, `CHECK`, `ON DELETE CASCADE`) garantissent la cohérence sans logique applicative. MongoDB aurait introduit une flexibilité inutile sans gain réel.

**MinIO vs filesystem local**  
Le service `FileStorageService` abstrait le backend de stockage via l'AWS SDK. En développement, MinIO tourne en local dans Docker. En production, il suffit de pointer les variables d'environnement vers un bucket AWS S3 réel — aucun changement de code.

---

## 3. Modèle de données

### Modèle Conceptuel de Données (MCD)

```
┌──────────────────┐          ┌───────────────────────────┐
│      USER        │          │          FILE             │
├──────────────────┤          ├───────────────────────────┤
│ id (PK)          │  0,N     │ id (PK)                   │
│ email (UK)       │◄─────────│ original_name             │
│ password (hash)  │  uploads │ storage_path              │
│ created_at       │          │ mime_type                 │
└──────────────────┘          │ size (BIGINT)             │
                              │ token (UK, UUID v4)       │
                              │ password_hash (nullable)  │
                              │ expires_at                │
                              │ uploaded_at               │
                              │ user_id (FK, nullable)    │
                              └──────────┬────────────────┘
                                         │ 1,1  has
                                         │
                              ┌──────────▼────────────────┐
                              │          TAG              │
                              ├───────────────────────────┤
                              │ id (PK)                   │
                              │ name (max 30 chars)       │
                              │ file_id (FK)              │
                              └───────────────────────────┘
```

**Cardinalités**
- `USER` → `FILE` : un utilisateur possède 0 à N fichiers ; un fichier appartient à 0 ou 1 utilisateur (`user_id` nullable pour les uploads anonymes)
- `FILE` → `TAG` : un fichier a 0 à N tags ; un tag appartient à exactement 1 fichier

### Modèle Logique de Données (MLD)

```
users  ( id PK, email UK NOT NULL, password NOT NULL, created_at NOT NULL )

files  ( id PK, original_name, storage_path, mime_type, size, token UK,
         password_hash NULL, expires_at, uploaded_at,
         #user_id FK → users(id) ON DELETE SET NULL )

tags   ( id PK, name, #file_id FK → files(id) ON DELETE CASCADE )
         UNIQUE (file_id, name)
```

### Détail des tables

**`users`**

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE |
| `password` | VARCHAR(255) | NOT NULL (bcrypt) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() |

**`files`**

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `original_name` | VARCHAR(255) | NOT NULL |
| `storage_path` | VARCHAR(500) | NOT NULL |
| `mime_type` | VARCHAR(100) | NOT NULL |
| `size` | BIGINT | NOT NULL, ≤ 1 073 741 824 |
| `token` | VARCHAR(36) | NOT NULL, UNIQUE (UUID v4) |
| `password_hash` | VARCHAR(255) | NULL |
| `expires_at` | TIMESTAMP | NOT NULL |
| `uploaded_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() |
| `user_id` | INTEGER | NULL, FK → users(id) |

**`tags`**

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `name` | VARCHAR(30) | NOT NULL |
| `file_id` | INTEGER | NOT NULL, FK → files(id) CASCADE |

### Choix de conception notables

- **`user_id` nullable** : permet les uploads anonymes (US07) sans table séparée. La règle "pas d'historique pour les anonymes" est appliquée en couche API.
- **`token` séparé de `id`** : UUID v4 non devinable comme identifiant public — évite l'énumération des uploads par simple incrémentation.
- **`storage_path` abstrait** : même champ pour un chemin local ou une clé S3 — changement de backend sans migration.
- **TAG en one-to-many** : les tags sont des labels propres à un fichier, pas un vocabulaire partagé — pas de table pivot nécessaire.

---

## 4. Documentation d'API

### Spécification OpenAPI

Le contrat d'interface complet est disponible à la racine du projet :

- **[`openapi.yaml`](openapi.yaml)** — Spécification OpenAPI 3.1 complète
- **[`API_CONTRACT.md`](API_CONTRACT.md)** — Version lisible en Markdown avec exemples
- **Interface Swagger UI** : accessible sur `http://localhost/api/doc` quand la stack est lancée

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| Base URL | `/api` |
| Format de données | JSON (sauf upload/download : `multipart/form-data` / stream binaire) |
| Authentification | JWT Bearer — `Authorization: Bearer <token>` |

### Résumé des endpoints

| Méthode | Chemin | Accès | Description |
|---------|--------|-------|-------------|
| `POST` | `/api/auth/register` | Public | Créer un compte |
| `POST` | `/api/auth/login` | Public | Connexion, retourne un JWT |
| `POST` | `/api/files` | Auth ou Anonyme | Uploader un fichier |
| `GET` | `/api/files` | Auth | Historique des fichiers |
| `GET` | `/api/files/{token}` | Public | Métadonnées d'un fichier |
| `GET` | `/api/files/{token}/download` | Public | Télécharger un fichier |
| `DELETE` | `/api/files/{id}` | Auth | Supprimer un fichier |

### Format des erreurs

Toutes les erreurs retournent un JSON uniforme :

```json
{
  "error": "ERROR_CODE",
  "message": "Description lisible"
}
```

| Code HTTP | Cas |
|-----------|-----|
| `400` | Validation échouée |
| `401` | JWT manquant, expiré ou mot de passe fichier incorrect |
| `403` | Fichier appartenant à un autre utilisateur |
| `404` | Ressource introuvable ou expirée |
| `409` | Email déjà enregistré |
| `413` | Fichier > 1 Go |
| `422` | Type de fichier interdit |

---

## 5. Sécurité et gestion des accès

### Authentification

Le système d'authentification repose sur des **tokens JWT signés en RS256** (algorithme asymétrique RSA 4096 bits), gérés par `lexik/jwt-authentication-bundle`.

| Aspect | Détail |
|--------|--------|
| Algorithme | RS256 (clé privée pour signer, clé publique pour vérifier) |
| Durée de vie du token | 3600 secondes (configurable via `JWT_TOKEN_TTL`) |
| Transport | Header HTTP `Authorization: Bearer <token>` |
| Stockage côté client | `localStorage` (token supprimé à la déconnexion) |
| Expiration côté front | Redirection automatique vers `/login` sur réponse 401 |

### Gestion des rôles et permissions

Il n'y a pas de système de rôles multiples dans le MVP. La logique d'accès est binaire :

| Action | Condition |
|--------|-----------|
| Uploader un fichier authentifié | JWT valide |
| Uploader anonymement | Aucun JWT dans la requête |
| Accéder à l'historique | JWT valide |
| Supprimer un fichier | JWT valide **et** `file.user_id === token.user_id` |
| Télécharger un fichier | Public (+ mot de passe si protégé) |

### Chiffrement des mots de passe

| Type | Algorithme | Détail |
|------|-----------|--------|
| Mot de passe utilisateur | BCrypt (cost 12) | Via `UserPasswordHasherInterface` Symfony |
| Mot de passe fichier | BCrypt (cost default) | Via `password_hash()` PHP natif |

Les mots de passe ne sont jamais stockés en clair ni retournés dans les réponses API.

### Validation des entrées

Toutes les entrées sont validées **côté serveur** (Symfony Validator) et **côté client** (React) :

| Règle | Couche |
|-------|--------|
| Email valide et unique | Symfony `Assert\Email` + contrainte DB UNIQUE |
| Mot de passe utilisateur ≥ 8 chars | `Assert\Length(min: 8)` |
| Mot de passe fichier ≥ 6 chars | Vérification manuelle + UI |
| Taille fichier ≤ 1 Go | Nginx `client_max_body_size 1g` + contrôle PHP |
| Extensions interdites | Blacklist côté serveur : `exe, bat, cmd, dll, vbs, ps1...` |
| Tags ≤ 30 chars | `Assert\Length` + contrainte DB `VARCHAR(30)` |
| Expiration 1–7 jours | Contrôle numérique PHP |

### Résultats du scan de sécurité

Scan effectué avec `npm audit` et `trivy fs` (voir [`SECURITY.md`](SECURITY.md)) :

| Outil | Résultat |
|-------|---------|
| `npm audit` | **0 vulnérabilité** sur 539 dépendances |
| `trivy fs` (composer.lock) | **0 CVE** |
| `trivy fs` (package-lock.json) | **0 CVE** |
| `trivy fs` (secrets) | 1 finding HIGH : clé privée JWT chiffrée — **accepté** (chiffrée avec passphrase, dev uniquement) |

### Recommandations pour la production

- Activer HTTPS (certificat TLS via Let's Encrypt sur Nginx)
- Ne pas committer les clés JWT — injecter via secret manager
- Ajouter un rate limiting sur `/api/auth/login` (Nginx `limit_req`)
- Restreindre les origines CORS via `nelmio/cors-bundle`
- Ajouter les headers de sécurité HTTP (`X-Frame-Options`, `CSP`, `X-Content-Type-Options`)

---

## 6. Qualité, tests et maintenance

Les détails complets sont dans les fichiers dédiés du dépôt. Voici une synthèse.

### Plan de tests (voir [`TESTING.md`](TESTING.md))

| Type | Outil | Fichiers | Résultat |
|------|-------|----------|---------|
| Tests unitaires backend | PHPUnit 13 | 14 fichiers, ~85 méthodes | ✅ Passing |
| Tests unitaires frontend | Vitest 4 | 10 fichiers, 115 cas | ✅ Passing |
| Tests E2E | Cypress 15 | 5 fichiers, **26 scénarios** | Exécutables avec stack Docker |

Les 26 scénarios Cypress couvrent l'intégralité des 10 user stories : inscription, connexion, déconnexion, upload authentifié et anonyme, protection par mot de passe, téléchargement, historique, filtrage par tags, suppression.

**Couverture de code (frontend)**

| Indicateur | Résultat | Seuil requis |
|------------|---------|-------------|
| Instructions | **85.34%** | 70% ✅ |
| Branches | **83.33%** | 70% ✅ |
| Fonctions | **82.82%** | 70% ✅ |
| Lignes | **88.63%** | 70% ✅ |

Rapport HTML disponible après `cd frontend && npm run coverage` → `frontend/coverage/index.html`.

**CI/CD (GitHub Actions)**

Le pipeline s'exécute à chaque push sur `main` et chaque Pull Request :
- Job **Frontend** : `npm ci` → `vitest run` → `vitest run --coverage` → artifact uploaded
- Job **Backend** : `composer install` → génération clés JWT → migrations → `phpunit --coverage-clover` → artifact uploaded

### Sécurité (voir [`SECURITY.md`](SECURITY.md))

0 vulnérabilité CVE sur l'ensemble des dépendances npm et Composer. Un seul finding documenté : la clé privée JWT chiffrée présente dans le dépôt pour le développement local, acceptable car protégée par passphrase.

### Performance (voir [`PERF.md`](PERF.md))

Tests de charge définis avec **k6** sur les deux endpoints critiques :

| Endpoint | Scénario k6 | Threshold p95 |
|----------|------------|---------------|
| `POST /api/files` (upload) | Rampe 1→20 VU / 2 min | < 3 000 ms |
| `GET /api/files/{token}/download` | 20 VU constants / 1 min | < 500 ms |

Scripts disponibles dans `perf/k6-upload.js` et `perf/k6-download.js`.

Budget de performance frontend : bundle JS gzippé < 500 Ko, LCP < 2,5s.

### Maintenance (voir [`MAINTENANCE.md`](MAINTENANCE.md))

| Procédure | Fréquence |
|-----------|-----------|
| Audit des dépendances (`npm audit`, `composer audit`) | À chaque PR + mensuel |
| Mises à jour patch/mineur | Mensuel |
| Rotation des clés JWT | Tous les 90 jours en production |
| Sauvegarde PostgreSQL | Quotidienne, rétention 30 jours |
| Sauvegarde MinIO | Quotidienne, synchronisée avec la BDD |

---

## 7. Processus d'installation et d'exécution

### Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Docker | 24+ |
| Docker Compose | 2.20+ |
| Git | 2.40+ |
| (Optionnel) k6 | 0.50+ — pour les tests de performance |
| (Optionnel) Node.js | 20+ — pour les tests Cypress en local |

### Installation

```bash
# 1. Cloner le dépôt
git clone git@github.com:aiswarms/datashare.git
cd datashare

# 2. Configurer les variables d'environnement
cp api/.env api/.env.local
# Éditer api/.env.local avec vos valeurs (voir section Variables)

# 3. Lancer la stack complète
docker compose up -d

# L'entrypoint de l'API attend PostgreSQL, puis lance les migrations automatiquement.
```

L'application est accessible sur **http://localhost**.

### Commandes principales

```bash
# Démarrer / arrêter la stack
docker compose up -d
docker compose down

# Voir les logs
docker compose logs -f api

# Lancer les tests backend
docker compose exec api php vendor/bin/phpunit

# Lancer les tests frontend
cd frontend && npm test

# Lancer la couverture frontend
cd frontend && npm run coverage
# → rapport dans frontend/coverage/index.html

# Lancer les tests E2E Cypress (stack up requise)
cd frontend && npm run cy:run    # headless
cd frontend && npm run cy:open   # interface graphique

# Lancer un test de charge k6
k6 run perf/k6-download.js
```

### Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `APP_SECRET` | Secret Symfony (32 chars min) | `a1b2c3...` |
| `DATABASE_URL` | URL PostgreSQL | `postgresql://datashare:datashare@db:5432/datashare?serverVersion=16` |
| `JWT_PASSPHRASE` | Passphrase de la clé privée JWT | `changeme` |
| `S3_ENDPOINT` | URL MinIO / S3 | `http://minio:9000` |
| `S3_ACCESS_KEY` | Clé d'accès S3 | `datashare` |
| `S3_SECRET_KEY` | Clé secrète S3 | `datashare` |
| `S3_REGION` | Région S3 | `us-east-1` |
| `S3_BUCKET` | Nom du bucket | `datashare` |

> En développement, les valeurs par défaut du `docker-compose.yml` sont fonctionnelles sans configuration supplémentaire.

---

## 8. Utilisation de l'IA dans le développement

### Posture adoptée

L'IA (Claude Code) a été utilisée selon une approche de **binômage actif** : l'IA prend en charge l'implémentation technique pendant que le développeur pilote les choix fonctionnels, valide le résultat et corrige les erreurs. Cette posture se situe entre l'assignation de tâches à un junior (instructions précises, revue systématique) et le vibe coding (confiance dans le flux), avec une supervision constante des décisions d'architecture.

### Tâches confiées à l'IA

| Catégorie | Exemples de tâches |
|-----------|--------------------|
| **Architecture** | Conception du MCD/MLD, choix du schéma de données, justification des cardinalités |
| **Implémentation fonctionnelle** | Controllers Symfony (upload, download, auth, historique, suppression), pages React (upload, téléchargement, espace personnel), API client TypeScript |
| **Tests** | Écriture des suites PHPUnit (intégration + unitaires), tests Vitest pour chaque composant, 26 scénarios Cypress E2E |
| **Infrastructure** | Dockerfile, docker-compose.yml, entrypoint.sh avec attente PostgreSQL et migrations automatiques, workflow GitHub Actions |
| **Documentation** | TESTING.md, SECURITY.md, PERF.md, MAINTENANCE.md, API_CONTRACT.md, MCD.md, MLD.md |
| **Sécurité** | Scripts de scan (trivy, npm audit), analyse des résultats, recommandations |
| **Performance** | Scripts k6 pour upload et download |

### Supervision et corrections apportées

La revue humaine a été indispensable à plusieurs reprises :

- **Erreur de lockfile Composer** : l'IA a ajouté `symfony/monolog-bundle` dans `composer.json` manuellement sans mettre à jour `composer.lock`, cassant la stack Docker et la CI. Détecté par les erreurs de build, corrigé en supprimant la configuration problématique.
- **Fichier `composer.lock` vidé** : une commande `cat > composer.lock` exécutée sur un container non démarré a écrasé le fichier avec du vide. Restauration depuis git nécessaire.
- **Base de données inexistante en CI** : la CI créait `datashare` mais Symfony en mode `test` cherchait `datashare_test` (suffixe configuré dans `doctrine.yaml`). Corrigé après analyse de la config Doctrine.
- **Clés JWT absentes en CI** : les clés ne sont pas versionnées (normal). Ajout d'une étape `lexik:jwt:generate-keypair` dans le workflow.
- **Ajustements UI** : certains textes et comportements des tests Cypress ne correspondaient pas exactement au DOM réel (libellés, `data-testid`). Corrections après lecture des composants React.

### Apports constatés

- **Gain de temps significatif** sur les tâches répétitives : écriture des tests (85 méthodes PHPUnit, 115 cas Vitest, 26 scénarios Cypress), rédaction de la documentation, configuration CI/CD.
- **Cohérence** : l'IA maintient une cohérence entre les couches (noms de routes, types TypeScript alignés avec les réponses PHP, `data-testid` respectés dans les tests Cypress).
- **Qualité de la documentation** : les fichiers MCD.md, MLD.md, API_CONTRACT.md sont précis et directement exploitables.

### Limites constatées

- **Pas de vérification d'exécution** : l'IA propose du code valide syntaxiquement mais ne peut pas tester l'exécution réelle sans que la stack soit lancée. Des erreurs d'environnement (lockfile, variables CI) n'ont été détectées qu'à l'exécution.
- **Dépendances implicites** : l'ajout de `monolog.yaml` sans installer le bundle illustre la limite de l'IA sur les dépendances implicites d'un écosystème (ici, Symfony nécessite que le bundle soit dans `composer.lock`).
- **Connaissance du contexte runtime** : l'IA ne connaît pas l'état réel du système (containers en marche ou non, état du filesystem) et peut proposer des commandes qui échouent silencieusement.

### Journal d'usage IA

Le fichier [`journal-ia.md`](journal-ia.md) documente les interactions IA session par session, conformément aux exigences du projet.
