FROM php:8.4-cli

# Extensions requises par Symfony + API Platform + PostgreSQL
RUN apt-get update && apt-get install -y \
    git unzip libpq-dev libicu-dev \
    && docker-php-ext-install pdo pdo_pgsql intl \
    && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install --no-scripts --no-autoloader

COPY . .
RUN composer dump-autoload --optimize

COPY php.ini /usr/local/etc/php/conf.d/uploads.ini

EXPOSE 8000

CMD ["php", "-S", "0.0.0.0:8000", "-t", "public"]
