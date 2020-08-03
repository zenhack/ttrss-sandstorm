#!/bin/bash

set -euo pipefail

wait_for() {
    local service=$1
    local file=$2
    while [ ! -e "$file" ] ; do
        echo "waiting for $service to be available at $file."
        sleep .1
    done
}

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

# Wait until mysql has bound its socket, indicating readiness
wait_for mysql /var/run/mysqld/mysqld.sock

if [ -d /var/lib/php5 ] ; then
    # This means we're upgrading from an old version of the app, before we were using
    # the .db-created sentinel file; create it, so the rest of the script correctly
    # treats this as a pre-existing grain.
    touch /var/.db-created
    rm -rf /var/lib/php5
fi
if [ ! -e /var/.db-created ]; then
    mysql --user "$MYSQL_USER" -e "CREATE DATABASE $MYSQL_DATABASE"
    mysql --user "$MYSQL_USER" --database "$MYSQL_DATABASE" < /opt/app/schema/ttrss_schema_mysql.sql
    # Delete the TTRSS project's feeds from the db; otherwise on start up the user will
    # get a bunch of powerbox requests immediately on startup, which is not great UX:
    mysql --user "$MYSQL_USER" --database "$MYSQL_DATABASE" -e "DELETE FROM ttrss_feeds"
    touch /var/.db-created
fi

# Start our powerbox proxy server, and wait for it to write the cert:
export DB_TYPE=mysql
export DB_URI="$MYSQL_USER@/$MYSQL_DATABASE"
export CA_CERT_PATH=/var/ca-spoof-cert.pem
rm -f $CA_CERT_PATH
/opt/app/.sandstorm/powerbox-http-proxy/powerbox-http-proxy &
wait_for "root cert" "$CA_CERT_PATH"

export http_proxy=http://127.0.0.1:$POWERBOX_PROXY_PORT
export https_proxy=http://127.0.0.1:$POWERBOX_PROXY_PORT

# Spawn php:
/usr/sbin/php-fpm7.0 --nodaemonize --fpm-config /etc/php/7.0/fpm/php-fpm.conf &
# Wait for it to start:
wait_for php-fpm7.0 /var/run/php/php7.0-fpm.sock

# Try to update feeds once immediately on startup, then start the
# background daemon.
/usr/bin/php7.0 /opt/app/update.php --feeds --daemon &
wait_for update-daemon /var/lock/update_daemon.stamp

/opt/app/.sandstorm/apphooks/ttrss-apphooks &

# Start nginx.
/usr/sbin/nginx -c /etc/nginx.conf -g "daemon off;"

# vim: set ts=4 sw=4 et :
