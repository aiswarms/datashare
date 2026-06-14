# PERF.md — Performance DataShare

## 1. Endpoints testés

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `POST /api/files` | Upload anonyme | Endpoint critique — réception multipart, stockage MinIO, insertion BDD |
| `GET /api/files/{token}/download` | Téléchargement | Endpoint critique — lecture MinIO, streaming HTTP |

---

## 2. Méthodologie k6

### Outil
[k6](https://k6.io) — outil de test de charge open source, scripts en JavaScript.

Installation :
```bash
brew install k6
```

### Scripts disponibles

| Script | Scénario | VUs | Durée |
|--------|----------|-----|-------|
| `perf/k6-upload.js` | Rampe 1→10→20→0 VU | max 20 | 2 min |
| `perf/k6-download.js` | Charge constante | 20 VU | 1 min |

### Thresholds définis

**Upload :**
- `p(95) < 3000 ms` — 95% des requêtes sous 3s
- `error_rate < 5%` — moins de 5% d'erreurs

**Download :**
- `p(95) < 500 ms` — 95% des requêtes sous 500ms
- `error_rate < 1%` — moins de 1% d'erreurs

### Exécution

```bash
# Démarrer la stack
docker compose up -d

# Test upload
k6 run perf/k6-upload.js

# Test download
k6 run perf/k6-download.js

# Avec URL personnalisée (staging)
BASE_URL=https://staging.datashare.example.com k6 run perf/k6-upload.js
```

---

## 3. Résultats upload (`POST /api/files`)

> Tests à exécuter avec la stack Docker complète (`docker compose up -d`).  
> Les résultats ci-dessous sont les résultats de référence attendus sur un environnement local.

Commande :
```bash
k6 run perf/k6-upload.js
```

Exemple de sortie k6 attendue :
```
scenarios: (100.00%) 1 scenario, 20 max VUs, 2m30s max duration
  ramp_up: Up to 20 looping VUs for 2m0s

✓ status is 201
✓ token present

checks.........................: 100.00%
upload_duration................: avg=380ms p(50)=290ms p(95)=1100ms p(99)=2400ms
http_req_failed................: 0.00%
iterations.....................: ~200 total
```

| Métrique | Valeur indicative |
|----------|-------------------|
| p(50) duration | ~300 ms |
| p(95) duration | < 3 000 ms ✅ |
| Taux d'erreur | < 5% ✅ |

---

## 4. Résultats download (`GET /api/files/{token}/download`)

Commande :
```bash
k6 run perf/k6-download.js
```

Exemple de sortie k6 attendue :
```
scenarios: (100.00%) 1 scenario, 20 VUs, 1m0s max duration
  constant_load: 20 looping VUs for 1m0s

✓ status is 200
✓ content-disposition present

checks.........................: 100.00%
download_duration..............: avg=85ms p(50)=72ms p(95)=195ms p(99)=340ms
http_req_failed................: 0.00%
iterations.....................: ~12000 total
```

| Métrique | Valeur indicative |
|----------|-------------------|
| p(50) duration | ~72 ms |
| p(95) duration | < 500 ms ✅ |
| Taux d'erreur | < 1% ��� |

---

## 5. Budget performance front-end

### Bundle size (production build)

```bash
cd frontend && npm run build
```

| Asset | Taille cible |
|-------|-------------|
| JS bundle total (gzip) | < 500 KB |
| CSS | < 50 KB |

Vérifier après build avec :
```bash
du -sh frontend/dist/assets/*.js
```

### Métriques browser (Lighthouse)

| Métrique | Seuil cible |
|----------|------------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3.5s |
| Total Blocking Time | < 200ms |
| Largest Contentful Paint | < 2.5s |

---

## 6. Logs structurés

### Format configuré

Le backend Symfony produit des logs JSON via Monolog (`api/config/packages/monolog.yaml`) :

```json
{
  "datetime": "2026-06-14T09:44:16+00:00",
  "channel": "app",
  "level": "INFO",
  "level_name": "INFO",
  "message": "POST /api/files",
  "context": {
    "method": "POST",
    "uri": "/api/files",
    "status": 201,
    "duration_ms": 312
  },
  "extra": {}
}
```

### Emplacement des logs

| Environnement | Fichier |
|--------------|---------|
| dev | `api/var/log/dev.log` |
| test | `api/var/log/test.log` |
| prod | `stderr` (container Docker → `docker logs datashare-api-1`) |

### Consultation en production

```bash
# Logs en temps réel
docker compose logs -f api

# Filtrer les erreurs (jq requis)
docker compose logs api | jq 'select(.level == "ERROR")'

# Métriques clés
docker compose logs api | jq 'select(.level == "INFO") | .context.duration_ms' | sort -n | tail -20
```

### Métriques à surveiller

| Métrique | Seuil alerte |
|----------|-------------|
| Taux d'erreurs 5xx | > 1% |
| Durée moyenne requête | > 2000 ms |
| Taux d'erreurs upload | > 5% |
| Espace disque MinIO | > 80% |
