# DataShare

Application web de partage de fichiers permettant aux utilisateurs — anonymes ou enregistrés — d'uploader des fichiers et de les partager via des liens de téléchargement temporaires, protégés par mot de passe.

## Fonctionnalités

- Upload de fichiers (authentifié ou anonyme) jusqu'à **1 Go**
- Liens de téléchargement avec **expiration 1–7 jours**
- **Protection par mot de passe** optionnelle par fichier
- **Historique** et suppression manuelle pour les utilisateurs enregistrés
- **Gestion des tags** (ajout / suppression de labels sur les fichiers)
- Purge automatique des fichiers expirés
- Authentification JWT

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Back-end | PHP 8.4 · Symfony 8.1 |
| Front-end | TypeScript · React 19 · Chakra UI |
| Base de données | PostgreSQL 16 |
| Stockage fichiers | MinIO (S3-compatible) |
| Auth | JWT RS256 (`lexik/jwt-authentication-bundle`) |
| Reverse proxy | Nginx |
| Conteneurisation | Docker / Docker Compose |

## Documentation

| Fichier | Description |
|---------|-------------|
| [`DOC_TECHNIQUE.md`](DOC_TECHNIQUE.md) | **Documentation technique complète** — architecture, choix technologiques, modèle de données, API, sécurité, qualité, installation, usage IA |
| [`API_CONTRACT.md`](API_CONTRACT.md) | Référence complète de l'API REST (endpoints, payloads, codes d'erreur) |
| [`TESTING.md`](TESTING.md) | Plan de tests — PHPUnit, Vitest, Cypress (26 scénarios E2E), couverture |
| [`SECURITY.md`](SECURITY.md) | Rapport de scan de sécurité (npm audit, trivy) et règles implémentées |
| [`PERF.md`](PERF.md) | Tests de performance k6 et budget front-end |
| [`MAINTENANCE.md`](MAINTENANCE.md) | Procédures de maintenance, rotation des secrets, sauvegardes |
| [`MCD.md`](MCD.md) | Modèle Conceptuel de Données |
| [`MLD.md`](MLD.md) | Modèle Logique de Données |
| [`SPEC_SUMMARY.md`](SPEC_SUMMARY.md) | User stories et contraintes techniques du MVP |
| [`journal-ia.md`](journal-ia.md) | Journal d'usage de l'IA |

## Installation rapide

**Prérequis** : Docker 24+, Docker Compose 2.20+

```bash
git clone git@github.com:aiswarms/datashare.git
cd datashare
docker compose up -d
```

L'application est accessible sur **http://localhost**.

L'entrypoint attend PostgreSQL, puis exécute les migrations automatiquement.

> Pour les détails (variables d'environnement, commandes de test, k6) → [`DOC_TECHNIQUE.md`](DOC_TECHNIQUE.md#7-processus-dinstallation-et-dexécution)

## API

Base URL : `/api` · Auth : `Authorization: Bearer <token>`

| Méthode | Chemin | Accès | Description |
|---------|--------|-------|-------------|
| `POST` | `/api/auth/register` | Public | Créer un compte |
| `POST` | `/api/auth/login` | Public | Connexion, retourne un JWT |
| `POST` | `/api/files` | Auth ou Anonyme | Uploader un fichier |
| `GET` | `/api/files` | Auth | Historique des fichiers |
| `GET` | `/api/files/{token}` | Public | Métadonnées d'un fichier |
| `GET` | `/api/files/{token}/download` | Public | Télécharger un fichier |
| `DELETE` | `/api/files/{id}` | Auth | Supprimer un fichier |

Interface Swagger UI disponible sur `http://localhost/api/doc`. Référence complète → [`API_CONTRACT.md`](API_CONTRACT.md)

## Modèle de données

Trois entités : **User**, **File**, **Tag**.

- Un fichier appartient à 0 ou 1 utilisateur (0 = upload anonyme)
- Un tag appartient à exactement 1 fichier ; les noms sont uniques par fichier
- Les tokens de téléchargement sont des UUID v4 — non devinables, distincts des IDs internes

Diagrammes complets → [`MCD.md`](MCD.md) · [`MLD.md`](MLD.md)

## Licence

MIT
