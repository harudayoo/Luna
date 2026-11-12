# Luna for the OCSPH office server (see compose.yml).
# One image: PHP-FPM + Nginx (serversideup/php, listens on 8080), the app, its Composer packages and the
# built Vite assets. Node is only in the build stage: Wayfinder runs `php artisan` during the Vite build,
# so that stage needs PHP and Node together.

FROM serversideup/php:8.4-fpm-nginx AS base

FROM base AS build
USER root
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
WORKDIR /var/www/html

# Dependencies first, so code-only changes rebuild quickly.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && npm run build \
    && rm -rf node_modules

FROM base AS app
COPY --from=build --chown=www-data:www-data /var/www/html /var/www/html
USER www-data
