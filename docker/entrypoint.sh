#!/bin/sh
set -eu

if [ -z "${CELLSTOCK_ADMIN_PASSWORD:-}" ]; then
  echo "ERROR: CELLSTOCK_ADMIN_PASSWORD is required." >&2
  exit 1
fi

mkdir -p "$(dirname "$CELLSTOCK_DB_PATH")" /var/www/html/backups
chown -R www-data:www-data "$(dirname "$CELLSTOCK_DB_PATH")" /var/www/html/backups

php /var/www/html/scripts/init-database.php
chown www-data:www-data "$CELLSTOCK_DB_PATH"

exec "$@"
