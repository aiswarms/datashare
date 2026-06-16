# PERF.md — Performance DataShare

## 1. Endpoints testés

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `POST /api/files` | Upload anonyme | Endpoint critique — réception multipart, stockage MinIO, insertion BDD |
| `GET /api/files/{token}/download` | Téléchargement | Endpoint critique — lecture MinIO, streaming HTTP |

---

## 2. Méthodologie k6 (back-end)

### Outil
[k6](https://k6.io) — outil de test de charge open source, scripts en JavaScript.

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

Résultats de référence mesurés sur environnement local (Docker Compose, machine de développement standard) :

| Métrique | Valeur mesurée |
|----------|----------------|
| Requêtes totales | ~200 sur 2 min |
| p(50) durée | ~300 ms |
| p(95) durée | ~1 100 ms ✅ (seuil : < 3 000 ms) |
| p(99) durée | ~2 400 ms |
| Taux d'erreur | 0 % ✅ (seuil : < 5 %) |
| Taille fichier transféré | ~10 KB (fixture testfile.txt) |

---

## 4. Résultats download (`GET /api/files/{token}/download`)

| Métrique | Valeur mesurée |
|----------|----------------|
| Requêtes totales | ~12 000 sur 1 min |
| p(50) durée | ~72 ms |
| p(95) durée | ~195 ms ✅ (seuil : < 500 ms) |
| p(99) durée | ~340 ms |
| Taux d'erreur | 0 % ✅ (seuil : < 1 %) |
| Débit moyen | ~200 req/s |

---

## 5. Budget performance front-end

### Bundle size (mesuré — `npm run build`)

Build exécuté le 2026-06-14 (après code splitting) :

```
dist/index.html                          0.38 kB │ gzip:   0.26 kB
dist/assets/index-DWBJVaOr.js         464.08 kB │ gzip: 130.83 kB
dist/assets/MySpacePage-Br5Q7oaI.js    11.20 kB │ gzip:   3.24 kB
dist/assets/DownloadPage-DJ9t0JsO.js    5.20 kB │ gzip:   2.04 kB
dist/assets/UploadPage-5ey5XX8A.js      4.44 kB │ gzip:   1.90 kB
dist/assets/HomePage-D3hWIeZz.js        4.34 kB │ gzip:   1.86 kB
dist/assets/LoginPage-CtoH3zzZ.js       1.80 kB │ gzip:   0.82 kB
dist/assets/RegisterPage-DIHkdvH-.js    2.15 kB │ gzip:   0.88 kB
```

| Asset | Taille brute | Taille gzip | Seuil cible | Statut |
|-------|-------------|-------------|-------------|--------|
| Bundle principal (Chakra UI + React) | 464 kB | **130 kB** | < 500 kB (gzip) | ✅ |
| Pages (chargées à la demande) | 2–11 kB | 0,8–3,2 kB | — | ✅ |
| HTML | 0.38 kB | 0.26 kB | — | ✅ |

> Le code splitting (`React.lazy`) divise l'application en chunks par page. Le navigateur charge uniquement la page demandée, ce qui réduit le JS à parser au premier affichage.

### Métriques navigateur (Lighthouse)

Analyse effectuée le 2026-06-14 sur `http://localhost/my-space` (Lighthouse 13.0.2, Chrome 148, machine locale).

| Métrique | Valeur mesurée | Seuil cible | Statut |
|----------|----------------|-------------|--------|
| First Contentful Paint (FCP) | **2,2 s** | < 1,5 s | ⚠️ |
| Largest Contentful Paint (LCP) | **3,9 s** | < 2,5 s | ❌ |
| Time to Interactive (TTI) | **3,9 s** | < 3,5 s | ⚠️ |
| Total Blocking Time (TBT) | **0 ms** | < 200 ms | ✅ |
| Cumulative Layout Shift (CLS) | **0,003** | < 0,1 | ✅ |
| Speed Index | **2,2 s** | — | — |

**Scores Lighthouse globaux :**

| Catégorie | Score |
|-----------|-------|
| Performance | 67 / 100 |
| Accessibility | 85 / 100 |
| Best Practices | 100 / 100 |
| SEO | 82 / 100 |

Lancer l'analyse Lighthouse :
```bash
# Via Chrome DevTools → Lighthouse → Generate report
# Ou en CLI :
npx lighthouse http://localhost --output html --output-path ./lighthouse-report.html
```

---

## 6. Analyse et pistes d'optimisation

### Observations

**FCP et LCP au-dessus des seuils** : les métriques Lighthouse indiquent un rendu initial lent (FCP 2,2 s, LCP 3,9 s, score Performance 67/100). Le navigateur doit télécharger, parser et exécuter le JS avant d'afficher quoi que ce soit.

**TBT et CLS excellents** : une fois le JS exécuté, l'application ne bloque pas le thread principal (TBT = 0 ms) et n'a aucun décalage de mise en page (CLS = 0,003). Le problème est uniquement le **chargement initial**, pas l'interactivité.

**Cause racine — Chakra UI** : après investigation, le vrai goulot d'étranglement n'est pas le code applicatif (pages de 1 à 11 kB) mais le **bundle vendeur** contenant Chakra UI v3, `@emotion` et `framer-motion` (130 kB gzip à lui seul). Ce bundle doit être téléchargé et exécuté en totalité avant le premier rendu, quelle que soit la page demandée.

### Optimisation appliquée — code splitting

Le **code splitting par route** a été implémenté via `React.lazy` + `Suspense` dans `src/App.tsx` :

```tsx
const HomePage = lazy(() => import('./pages/HomePage'))
const MySpacePage = lazy(() => import('./pages/MySpacePage'))
// ...
```

Résultat : le bundle principal passe de **514 kB à 464 kB** brut (143 kB → **130 kB** gzip) et chaque page est chargée à la demande.

**Impact mesuré sur Lighthouse : quasi nul.** Le code splitting améliore la mise en cache navigateur (les pages changent indépendamment du vendor bundle) mais ne réduit pas significativement le FCP/LCP — car le bundle vendeur Chakra UI reste entier et doit toujours être chargé en premier.

### Ce qui résoudrait vraiment le problème

| Action | Impact sur FCP/LCP | Complexité |
|--------|-------------------|------------|
| **Remplacer Chakra UI** par Tailwind CSS ou CSS natif | −80 à −100 kB gzip, FCP < 1 s probable | Élevée — refonte UI complète |
| **SSR** (Next.js ou Remix) | FCP quasi instantané (HTML pré-rendu) | Très élevée — changement d'architecture |
| **Compression Brotli** sur Nginx | −10 à −15% vs gzip | Faible |

Ces solutions impliquent des refactorisations majeures hors scope du MVP. Le choix de Chakra UI était justifié par la rapidité de développement et la qualité des composants accessibles — le compromis FCP/LCP est documenté et connu.

### Back-end : aucune action urgente

Les résultats k6 montrent des temps de réponse bien en dessous des seuils. L'axe d'amélioration back-end serait la mise en cache HTTP des métadonnées fichier (`Cache-Control: max-age=60` sur `GET /api/files/{token}`) pour réduire la charge PostgreSQL sur les téléchargements fréquents.
