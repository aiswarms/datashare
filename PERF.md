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

Build exécuté le 2026-06-14 :

```
dist/index.html                  0.38 kB │ gzip:   0.26 kB
dist/assets/index-Dwe-6roa.js  514.33 kB │ gzip: 143.63 kB
```

| Asset | Taille brute | Taille gzip | Seuil cible | Statut |
|-------|-------------|-------------|-------------|--------|
| JS bundle | 514 kB | **143 kB** | < 500 kB (gzip) | ✅ |
| HTML | 0.38 kB | 0.26 kB | — | ✅ |

> Le bundle gzippé (143 kB) est bien en dessous du budget de 500 kB. La taille brute (514 kB) déclenche un avertissement Vite sur le chunking — voir section 6 (optimisations).

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

**FCP et LCP au-dessus des seuils** : les métriques Lighthouse confirment que le rendu initial est trop lent (FCP 2,2 s, LCP 3,9 s). La cause est directement liée au **bundle monolithique de 514 kB brut** : le navigateur doit télécharger, parser et exécuter l'intégralité du JS avant d'afficher quoi que ce soit. Le score Performance de 67/100 reflète cet impact.

**TBT et CLS excellents** : une fois le JS exécuté, l'application ne bloque pas le thread principal (TBT = 0 ms) et n'a aucun décalage de mise en page (CLS = 0,003). Le problème est uniquement le **chargement initial**, pas l'interactivité.

**Dépendances lourdes** : Chakra UI v3 et ses dépendances (`@emotion`, `framer-motion`) représentent la majorité du poids. React Router ajoute également quelques kB.

### Actions d'optimisation possibles

| Action | Gain estimé | Complexité |
|--------|------------|------------|
| **Code splitting par route** avec `React.lazy()` + `Suspense` | −30 à −50% sur le chargement initial | Faible |
| **Tree-shaking Chakra UI** — n'importer que les composants utilisés | −10 à −20 kB | Faible |
| **Remplacement de framer-motion** par des animations CSS pures | −20 kB | Moyenne |
| **Chunking manuel** via `build.rollupOptions.output.manualChunks` | Améliore la mise en cache navigateur | Faible |
| **Compression Brotli** sur Nginx | −15% vs gzip | Faible (config Nginx) |

### Priorité recommandée

Le plus impactant à court terme est le **code splitting par route**, qui réduit le JS chargé sur la page d'accueil et améliore directement le TTI et le LCP pour les nouveaux visiteurs :

```tsx
// Avant
import UploadPage from './pages/UploadPage'

// Après
const UploadPage = React.lazy(() => import('./pages/UploadPage'))
```

### Back-end : aucune action urgente

Les résultats k6 montrent des temps de réponse bien en dessous des seuils. L'axe d'amélioration back-end serait la mise en cache HTTP des métadonnées fichier (`Cache-Control: max-age=60` sur `GET /api/files/{token}`) pour réduire la charge PostgreSQL sur les téléchargements fréquents.
