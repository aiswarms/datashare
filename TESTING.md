# TESTING.md — Plan de tests DataShare

## 1. Plan de tests

| US | Description | Unitaire / Intégration | E2E Cypress |
|----|-------------|----------------------|-------------|
| US01 | Upload authentifié | UploadControllerTest, UploadControllerUnitTest | Scénarios 7, 8, 9, 10 |
| US02 | Téléchargement via lien | DownloadControllerTest | Scénarios 15, 16 |
| US03 | Création de compte | RegisterControllerTest, RegisterControllerUnitTest | Scénarios 1, 2, 3 |
| US04 | Connexion JWT | LoginControllerTest, LoginControllerUnitTest | Scénarios 4, 5, 6 |
| US05 | Historique des fichiers | FileHistoryControllerTest, FileHistoryControllerUnitTest | Scénarios 21, 25 |
| US06 | Suppression de fichier | DeleteFileControllerTest | Scénarios 23, 24 |
| US07 | Upload anonyme | UploadControllerTest (cas anonymes) | Scénarios 12, 13, 14 |
| US08 | Filtrage par tags | FileHistoryControllerTest | Scénarios 22 |
| US09 | Protection mot de passe | DownloadControllerTest | Scénarios 17, 18, 19 |
| US10 | Expiration automatique | PurgeExpiredFilesCommandTest | Scénario 26 |

---

## 2. Tests unitaires et d'intégration — Backend (PHPUnit)

### Prérequis

- PHP 8.4+
- Docker (PostgreSQL + MinIO) : `docker compose up -d db minio`
- Variables d'environnement : copier `.env` et adapter `.env.test` si besoin

### Exécution

```bash
cd api

# Tous les tests
php vendor/bin/phpunit

# Avec couverture (nécessite PCOV ou Xdebug dans le container)
docker compose exec api php vendor/bin/phpunit \
  --coverage-text \
  --coverage-html var/coverage
```

### Résultats actuels

| Suite | Fichiers | Tests | Statut |
|-------|----------|-------|--------|
| Controller (intégration) | 8 | ~65 | ✅ Passing |
| Unit/Controller | 4 | ~45 | ✅ Passing |
| Command | 1 | ~8 | ✅ Passing |
| Entity | 1 | ~3 | ✅ Passing |

> **Note couverture backend** : L'exécution de la couverture nécessite PCOV ou Xdebug activé dans le container Docker.
> ```bash
> docker compose exec api php vendor/bin/phpunit --coverage-text
> ```
> Le rapport HTML est généré dans `api/var/coverage/`.

---

## 3. Tests unitaires et d'intégration — Frontend (Vitest)

### Prérequis

- Node.js 20+
- `cd frontend && npm install`

### Exécution

```bash
cd frontend

# Tous les tests
npm test

# Avec rapport de couverture (HTML + lcov)
npm run coverage
# Rapport disponible dans frontend/coverage/index.html
```

### Résultats de couverture (mesurés le 2026-06-18)

```
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   92.03 |    91.93 |   88.42 |   96.08 |
 src               |   61.53 |   100.00 |   28.57 |  100.00 |
  App.tsx          |   61.53 |   100.00 |   28.57 |  100.00 |
 src/pages         |   92.30 |    91.26 |   91.17 |   95.53 |
  DownloadPage.tsx |   84.74 |    79.54 |   92.30 |   93.61 |
  HomePage.tsx     |   75.43 |    80.00 |   53.33 |   79.16 |
  MySpacePage.tsx  |  100.00 |   100.00 |  100.00 |  100.00 |
  UploadPage.tsx   |   96.05 |    95.00 |   95.83 |  100.00 |
-------------------|---------|----------|---------|---------|
Statements : 92.03% (358/389) ✅
Branches   : 91.93% (228/248) ✅
Functions  : 88.42% (107/121) ✅
Lines      : 96.08% (319/332) ✅
```

**Seuil requis : 70% — Seuil atteint sur tous les indicateurs.**

> Le rapport HTML détaillé est généré dans `frontend/coverage/index.html` après `npm run coverage`.

---

## 4. Tests E2E — Cypress

### Prérequis

- Stack complète en cours d'exécution : `docker compose up -d`
- `cd frontend && npm install`

### Exécution

```bash
cd frontend

# Mode headless (CI)
npm run cy:run

# Mode interactif (développement)
npm run cy:open
```

### Liste des 26 scénarios E2E

| # | Fichier | Description | US |
|---|---------|-------------|----|
| 1 | 01-auth | Inscription valide → redirection /login | US03 |
| 2 | 01-auth | Inscription email dupliqué → message d'erreur | US03 |
| 3 | 01-auth | Mots de passe non identiques → erreur | US03 |
| 4 | 01-auth | Connexion valide → redirection /upload | US04 |
| 5 | 01-auth | Mot de passe incorrect → erreur affiché | US04 |
| 6 | 01-auth | Déconnexion → retour accueil, token effacé | US04 |
| 7 | 02-upload | Upload fichier simple → lien de téléchargement | US01 |
| 8 | 02-upload | Upload avec mot de passe → succès | US01/US09 |
| 9 | 02-upload | Upload avec tags → tags visibles historique | US01/US08 |
| 10 | 02-upload | Upload expiration 1 jour → confirmation | US01/US10 |
| 11 | 02-upload | Upload type interdit (.exe) → 422 | US01 |
| 12 | 03-anonymous | Upload anonyme → succès + lien | US07 |
| 13 | 03-anonymous | Upload anonyme + mot de passe → succès | US07/US09 |
| 14 | 03-anonymous | Utilisateur auth → redirigé vers /upload | US07 |
| 15 | 04-download | Page affiche nom, taille, expiration | US02 |
| 16 | 04-download | Fichier non protégé → bouton actif | US02 |
| 17 | 04-download | Fichier protégé → champ mot de passe | US09 |
| 18 | 04-download | Bon mot de passe → pas d'erreur | US09 |
| 19 | 04-download | Mauvais mot de passe → erreur affichée | US09 |
| 20 | 04-download | Lien invalide → page "Lien invalide" | US02 |
| 21 | 05-history | Historique liste les fichiers uploadés | US05 |
| 22 | 05-history | Filtre par tag → fichiers filtrés | US08 |
| 23 | 05-history | Suppression → confirmation + retiré | US06 |
| 24 | 05-history | Annulation suppression → fichier reste | US06 |
| 25 | 05-history | Liste vide → message "Aucun fichier" | US05 |
| 26 | 05-history | Onglet "Actifs" → seulement actifs | US05 |

### Architecture Cypress

```
frontend/
  cypress/
    e2e/
      01-auth.cy.ts          # Auth (6 scénarios)
      02-upload.cy.ts        # Upload auth (5 scénarios)
      03-anonymous-upload.cy.ts  # Upload anonyme (3 scénarios)
      04-download.cy.ts      # Téléchargement (6 scénarios)
      05-history.cy.ts       # Historique (6 scénarios)
    support/
      commands.ts            # cy.apiRegister, cy.apiLogin, cy.apiUpload
      e2e.ts                 # Import commands + beforeEach cleanup
    fixtures/
      testfile.txt
  cypress.config.ts          # baseUrl: http://localhost
```

---

## 5. Critères d'acceptation par US

| US | Critère | Comment vérifier |
|----|---------|-----------------|
| US01 | Upload → token de téléchargement retourné | `npm run cy:run` — scénario 7 |
| US02 | Téléchargement sans compte | `npm run cy:run` — scénario 16 |
| US03 | Inscription unique par email | `npm run cy:run` — scénarios 1, 2 |
| US04 | JWT valide retourné après login | `php vendor/bin/phpunit` — LoginControllerTest |
| US05 | Historique propre à l'utilisateur | `npm run cy:run` — scénario 21 |
| US06 | Seul le propriétaire peut supprimer | `php vendor/bin/phpunit` — DeleteFileControllerTest |
| US07 | Upload anonyme sans token | `npm run cy:run` — scénario 12 |
| US08 | Filtre par tag fonctionnel | `npm run cy:run` — scénario 22 |
| US09 | Mot de passe haché, non récupérable | `php vendor/bin/phpunit` — DownloadControllerTest |
| US10 | Cron purge les fichiers expirés | `php vendor/bin/phpunit` — PurgeExpiredFilesCommandTest |
