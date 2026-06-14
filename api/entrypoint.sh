#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until pg_isready -h db -p 5432 -U datashare -q; do
  sleep 1
done
echo "PostgreSQL is ready."

echo "Running database migrations..."
php bin/console doctrine:migrations:migrate --no-interaction

exec "$@"
