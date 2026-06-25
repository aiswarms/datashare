#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
error() { echo -e "${RED}[deploy]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Helpers secrets
# Priorité : variable d'environnement déjà définie > valeur par défaut passée
# en argument > prompt interactif.
#
# Usage : get_secret VAR_NAME "valeur par défaut ou vide" [--secret]
#   --secret : masque la saisie (mot de passe)
# ---------------------------------------------------------------------------
get_secret() {
  local var="$1"
  local default="$2"
  local secret_flag="${3:-}"

  # Déjà défini dans l'environnement → on l'utilise directement
  if [ -n "${!var:-}" ]; then
    return
  fi

  # Valeur par défaut disponible → on l'utilise sans demander
  if [ -n "$default" ]; then
    export "$var"="$default"
    return
  fi

  # Prompt interactif
  if [ "$secret_flag" = "--secret" ]; then
    read -r -s -p "  $var (masqué) : " value; echo
  else
    read -r -p "  $var : " value
  fi

  if [ -z "$value" ]; then
    error "$var est requis."
    exit 1
  fi

  export "$var"="$value"
}

# ---------------------------------------------------------------------------
# VÉRIFICATIONS PRÉALABLES
# ---------------------------------------------------------------------------
if ! docker info > /dev/null 2>&1; then
  error "Docker n'est pas démarré. Lancez Docker puis réessayez."
  exit 1
fi

# ---------------------------------------------------------------------------
# DÉTECTION : première installation ou mise à jour
# ---------------------------------------------------------------------------
FIRST_INSTALL=false
[ ! -f "api/.env.local" ] && FIRST_INSTALL=true

# ---------------------------------------------------------------------------
# PREMIÈRE INSTALLATION — collecte des secrets
# ---------------------------------------------------------------------------
if [ "$FIRST_INSTALL" = true ]; then
  info "Première installation — configuration des variables d'environnement."
  echo

  # APP_SECRET : généré automatiquement s'il n'est pas fourni
  if [ -z "${APP_SECRET:-}" ]; then
    APP_SECRET="$(openssl rand -hex 32)"
    export APP_SECRET
    info "APP_SECRET généré automatiquement."
  fi

  warn "Renseignez les valeurs suivantes (Entrée = valeur par défaut indiquée)."
  echo

  # Variables avec défaut (fonctionnelles pour un déploiement local Docker)
  get_secret DATABASE_URL "postgresql://datashare:datashare@db:5432/datashare?serverVersion=16&charset=utf8"
  get_secret S3_ENDPOINT   "http://minio:9000"
  get_secret S3_ACCESS_KEY "datashare"
  get_secret S3_REGION     "us-east-1"
  get_secret S3_BUCKET     "datashare"

  # Variables sensibles sans défaut → prompt obligatoire si non définies
  warn "Les valeurs suivantes sont sensibles (saisie masquée) :"
  get_secret JWT_PASSPHRASE "" --secret
  get_secret S3_SECRET_KEY  "" --secret

  # Écriture de .env.local
  info "Écriture de api/.env.local..."
  cat > api/.env.local <<EOF
APP_ENV=prod
APP_SECRET=${APP_SECRET}
DATABASE_URL="${DATABASE_URL}"
JWT_PASSPHRASE=${JWT_PASSPHRASE}
S3_ENDPOINT=${S3_ENDPOINT}
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}
S3_REGION=${S3_REGION}
S3_BUCKET=${S3_BUCKET}
EOF

  info "api/.env.local créé."
fi

# ---------------------------------------------------------------------------
# MISE À JOUR DU CODE
# ---------------------------------------------------------------------------
info "Récupération des dernières modifications (git pull)..."
git pull origin main

# ---------------------------------------------------------------------------
# DÉMARRAGE DE LA STACK
# ---------------------------------------------------------------------------
info "Démarrage de la stack Docker..."
docker compose up -d --build

info "Attente que PostgreSQL soit prêt..."
until docker compose exec -T db pg_isready -U datashare -q; do
  sleep 2
done

# ---------------------------------------------------------------------------
# BACKEND
# ---------------------------------------------------------------------------
info "Installation des dépendances backend..."
docker compose exec -T api composer install --no-dev --optimize-autoloader

info "Application des migrations..."
docker compose exec -T api php bin/console doctrine:migrations:migrate --no-interaction

info "Génération des clés JWT (si absentes)..."
if ! docker compose exec -T api test -f config/jwt/private.pem 2>/dev/null; then
  docker compose exec -T api php bin/console lexik:jwt:generate-keypair
fi

info "Vidage du cache..."
docker compose exec -T api php bin/console cache:clear --env=prod

# ---------------------------------------------------------------------------
# FRONTEND
# ---------------------------------------------------------------------------
info "Installation des dépendances frontend..."
docker compose exec -T frontend npm ci

info "Build du frontend..."
docker compose exec -T frontend npm run build

# ---------------------------------------------------------------------------
# REDÉMARRAGE
# ---------------------------------------------------------------------------
info "Redémarrage des services..."
docker compose restart api frontend nginx

# ---------------------------------------------------------------------------
# SMOKE TEST
# ---------------------------------------------------------------------------
info "Vérification de santé de l'API..."
sleep 3
if curl -sf http://localhost/api/health > /dev/null; then
  info "Déploiement terminé. Application accessible sur http://localhost"
else
  error "Le health check a échoué. Consultez les logs : docker compose logs api"
  exit 1
fi
