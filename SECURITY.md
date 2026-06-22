# SECURITY.md — Analyse de sécurité DataShare

## 1. Périmètre du scan

Date d'analyse : 2026-06-14  
Outils utilisés : `npm audit`, `trivy fs`  
Périmètre : dépendances frontend (npm), dépendances backend (composer), fichiers du dépôt

---

## 2. Résultats npm audit (frontend)

Commande :
```bash
cd frontend && npm audit --json
```

**Résultat : 0 vulnérabilité**

| Niveau | Nombre |
|--------|--------|
| Critical | 0 |
| High | 0 |
| Moderate | 0 |
| Low | 0 |
| Total | 0 |

Dépendances analysées : 539 (162 prod, 378 dev, 33 optional).

---

## 3. Résultats trivy fs (dépôt complet)

Commande :
```bash
trivy fs . --exit-code 0
```

### 3.1 Dépendances (composer.lock + package-lock.json)

**Résultat : 0 vulnérabilité CVE**

| Cible | Type | Vulnérabilités |
|-------|------|----------------|
| api/composer.lock | composer | 0 |
| frontend/package-lock.json | npm | 0 |

### 3.2 Secrets détectés

| Fichier | Sévérité | Type | Décision |
|---------|----------|------|----------|
| `api/config/jwt/private.pem` | HIGH | Asymmetric Private Key | **Accepté** — voir analyse ci-dessous |

---

## 4. Analyse et décisions

### Finding : clé privée JWT dans le dépôt (`api/config/jwt/private.pem`)

**Description** : Trivy détecte la clé privée RSA utilisée pour signer les tokens JWT.

**Contexte** :
- La clé est **chiffrée avec un passphrase** (format `ENCRYPTED PRIVATE KEY`)
- Le passphrase est stocké dans la variable d'environnement `JWT_PASSPHRASE` (`.env`, non versionné en production)
- Cette approche est la configuration par défaut de `lexik/jwt-authentication-bundle` pour le développement

**Décision** : Accepté pour le développement. En production, la clé doit être injectée via une variable d'environnement ou un secret manager (HashiCorp Vault, AWS Secrets Manager).

**Action recommandée** :
```bash
# Ajouter à .gitignore pour les environnements de production
echo "api/config/jwt/*.pem" >> .gitignore
```

---

## 5. Règles de sécurité implémentées

### Authentification et autorisation
| Mesure | Implémentation |
|--------|---------------|
| JWT signé RS256 | `lexik/jwt-authentication-bundle`, clé RSA 4096 bits |
| Expiration token | Configurable via `JWT_TOKEN_TTL` (défaut 3600s) |
| Mot de passe haché | `password_hash()` avec `PASSWORD_BCRYPT` (cost 12) |
| Minimum longueur mdp utilisateur | 8 caractères (validé serveur + client) |
| Fichiers → propriétaire uniquement | Contrôle dans `DeleteFileController` + `FileHistoryController` |

### Validation des entrées
| Mesure | Implémentation |
|--------|---------------|
| Validation email | `Assert\Email` (Symfony Validator) |
| Extensions interdites | `['exe','bat','cmd','com','pif','vbs','ps1','msi','dll','sys','scr','sh']` |
| Taille max upload | 1 Go — Nginx `client_max_body_size 1g` + contrôle PHP + CHECK constraint DB (`size <= 1073741824`) |
| Validation expiration | 1–7 jours (contraint côté serveur) |
| Tags : longueur max | 30 caractères par tag |

### Protection des fichiers partagés
| Mesure | Implémentation |
|--------|---------------|
| Token unique de téléchargement | UUID v4 (`ramsey/uuid`) |
| Mot de passe sur fichier | `password_hash()` BCRYPT, min 6 caractères |
| Expiration automatique | Cron journalier `PurgeExpiredFilesCommand` |

### Infrastructure
| Mesure | Implémentation |
|--------|---------------|
| Stockage S3 isolé | MinIO (non exposé publiquement) |
| Reverse proxy | Nginx (seul point d'entrée HTTP) |
| Base de données isolée | PostgreSQL accessible uniquement en interne Docker |
| HTTPS | À configurer avec un certificat TLS en production |

### Recommandations production

1. **TLS obligatoire** : activer HTTPS sur nginx avec Let's Encrypt
2. **Clés JWT** : injecter via secret manager, ne pas commiter en prod
3. **Rate limiting** : ajouter sur `/api/auth/login` et `/api/files` (nginx `limit_req`)
4. **CORS** : restreindre l'origine dans `nelmio/cors-bundle`
5. **Headers sécurité** : ajouter `X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options` dans nginx
