FROM php:8.2-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-dev \
    && docker-php-ext-install pdo_sqlite \
    && rm -rf /var/lib/apt/lists/*

ENV CELLSTOCK_DB_PATH=/data/cellstock.sqlite
ENV CELLSTOCK_ADMIN_USERNAME=admin
ENV CELLSTOCK_LAB_NAME="FCT lab"

WORKDIR /var/www/html

COPY app/ /var/www/html/
COPY docker/entrypoint.sh /usr/local/bin/cellstock-entrypoint

RUN mkdir -p /data /var/www/html/backups \
    && chown -R www-data:www-data /data /var/www/html/backups /var/www/html/db \
    && chmod +x /usr/local/bin/cellstock-entrypoint

EXPOSE 80

ENTRYPOINT ["cellstock-entrypoint"]
CMD ["apache2-foreground"]
