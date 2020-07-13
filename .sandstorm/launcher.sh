#!/bin/bash
set -xeuo pipefail
mkdir -p /var/lib

mkdir -p /var/feed-icons; chmod 0777 /var/feed-icons
test -f /var/cache || cp -r /opt/app/cache /var
rm -rf /var/lock
mkdir -p /var/lock
mkdir -p /var/lib/php/sessions

# Create a bunch of folders under the clean /var that php, nginx, and mysql expect to exist
mkdir -p /var/lib/mysql
mkdir -p /var/lib/nginx
mkdir -p /var/log
mkdir -p /var/log/mysql
mkdir -p /var/log/nginx
# Wipe /var/run, since pidfiles and socket files from previous launches should go away
# TODO someday: I'd prefer a tmpfs for these.
rm -rf /var/run
mkdir -p /var/run
mkdir -p /var/run/mysqld

# Ensure mysql tables created
if [ ! -d /var/lib/mysql/mysql ] ; then
    HOME=/etc/mysql bash -x /usr/bin/mysql_install_db --force
fi

# Spawn mysqld, php
HOME=/etc/mysql /usr/sbin/mysqld &
/usr/sbin/php-fpm7.0 --nodaemonize --fpm-config /etc/php/7.0/fpm/php-fpm.conf &
# Wait until mysql and php have bound their sockets, indicating readiness
while [ ! -e /var/run/mysqld/mysqld.sock ] ; do
    echo "waiting for mysql to be available at /var/run/mysqld/mysqld.sock"
    sleep .2
done

MYSQL_USER="root"
MYSQL_DATABASE="app"
if [ ! -e "/var/lib/mysql/${MYSQL_DATABASE}" ]; then
    /usr/bin/mysql --user "$MYSQL_USER" -e "CREATE DATABASE $MYSQL_DATABASE"
    /usr/bin/mysql --user "$MYSQL_USER" --database "$MYSQL_DATABASE" < /opt/app/schema/ttrss_schema_mysql.sql
    touch /var/.db-created
fi

while [ ! -e /var/run/php-fpm.sock ] ; do
    echo "waiting for php-fpm to be available at /var/run/php-fpm.sock"
    sleep .2
done

# run update every 30 min, and pause 20s before the first run (to give time for server to start)
bash -c 'cd /opt/app; sleep 20; while true; do /usr/bin/php /opt/app/update.php --feeds --force-update; sleep 1800; done' 2>&1 &

# Start nginx.
/usr/sbin/nginx -g "daemon off;"
