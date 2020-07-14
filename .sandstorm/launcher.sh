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

# Spawn mysqld
HOME=/etc/mysql /usr/sbin/mysqld --skip-grant-tables &

# Generate a phony CA so our powerbox proxy can MITM ttrss's HTTPS requests.
# It doesn't take that long, so we just nuke it on every startup; this way we
# don't have to worry about expiration.
#
# Now is a good time to do this, since mysql can take a moment to start:
rm -rf /var/caspoof
mkdir -p /var/caspoof
# Generate the key & root cert. Just fill in the defaults
# For the various questions it asks (country name and such):
(yes '' || true) | openssl req -x509 \
    -newkey rsa:2048 -nodes \
    -keyout /var/caspoof/key.pem \
    -out /var/caspoof/cert.pem \
    -sha256 \
    -days 1825
# It doesn't *really* matter in this case, but general hygene
# thing, make the key only readable by owner:
chmod 0400 /var/caspoof/key.pem

# Wait until mysql has bound its socket, indicating readiness
while [ ! -e /var/run/mysqld/mysqld.sock ] ; do
    echo "waiting for mysql to be available at /var/run/mysqld/mysqld.sock"
    sleep .2
done
if [ ! -e /var/.db-created ]; then
    mysql --user "$MYSQL_USER" -e "CREATE DATABASE $MYSQL_DATABASE"
    mysql --user "$MYSQL_USER" --database "$MYSQL_DATABASE" < /opt/app/schema/ttrss_schema_mysql.sql
    touch /var/.db-created
fi

# Start our powerbox proxy server:
/opt/app/.sandstorm/powerbox/server/server &

export http_proxy=http://127.0.0.1:$POWERBOX_PROXY_PORT
export https_proxy=http://127.0.0.1:$POWERBOX_PROXY_PORT

# Spawn php:
/usr/sbin/php-fpm7.0 --nodaemonize --fpm-config /etc/php/7.0/fpm/php-fpm.conf &

# Wait for it to start:
while [ ! -e /var/run/php/php7.0-fpm.sock ] ; do
    echo "waiting for php-fpm7.0 to be available at /var/run/php/php7.0-fpm.sock"
    sleep .2
done

# Start nginx.
/usr/sbin/nginx -c /opt/app/.sandstorm/service-config/nginx.conf -g "daemon off;"

# vim: set ts=4 sw=4 et :
