#!/bin/bash

set -euo pipefail

# Create a bunch of folders under the clean /var that php, nginx, and mysql expect to exist
mkdir -p /var/lib/mysql
mkdir -p /var/lib/mysql-files
mkdir -p /var/lib/nginx
mkdir -p /var/lib/php/sessions
mkdir -p /var/log
mkdir -p /var/log/mysql
mkdir -p /var/log/nginx

# specific to tt-rss:
mkdir -p /var/cache/images
mkdir -p /var/cache/upload
mkdir -p /var/cache/export
mkdir -p /var/lock

if [ ! -d /var/feed-icons ]; then
    cp -r /opt/app/feed-icons /var/
fi

# Wipe /var/run, since pidfiles and socket files from previous launches should go away
# TODO someday: I'd prefer a tmpfs for these.
rm -rf /var/run
mkdir -p /var/run/php
rm -rf /var/tmp
mkdir -p /var/tmp
mkdir -p /var/run/mysqld

# Ensure mysql tables created
# HOME=/etc/mysql /usr/bin/mysql_install_db
HOME=/etc/mysql /usr/sbin/mysqld --initialize || true

# Spawn mysqld, php
HOME=/etc/mysql /usr/sbin/mysqld --skip-grant-tables &
/usr/sbin/php-fpm7.0 --nodaemonize --fpm-config /etc/php/7.0/fpm/php-fpm.conf &

# Wait until mysql has bound its socket, indicating readiness
while [ ! -e /var/run/mysqld/mysqld.sock ] ; do
    echo "waiting for mysql to be available at /var/run/mysqld/mysqld.sock"
    sleep .2
done
if [ ! -e /var/.db-created ]; then
    mysql --user root -e 'CREATE DATABASE app'
    mysql --user root --database app < /opt/app/schema/ttrss_schema_mysql.sql
    touch /var/.db-created
fi

# Start our powerbox proxy server:
/opt/app/.sandstorm/powerbox/server/server &

export http_proxy=http://127.0.0.1:$POWERBOX_PROXY_PORT
export https_proxy=http://127.0.0.1:$POWERBOX_PROXY_PORT

# Same for php:
while [ ! -e /var/run/php/php7.0-fpm.sock ] ; do
    echo "waiting for php-fpm7.0 to be available at /var/run/php/php7.0-fpm.sock"
    sleep .2
done

# Start nginx.
/usr/sbin/nginx -c /opt/app/.sandstorm/service-config/nginx.conf -g "daemon off;"

# vim: set ts=4 sw=4 et :
