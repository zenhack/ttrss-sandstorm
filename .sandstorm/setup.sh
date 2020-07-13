#!/bin/bash

set -xeuo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx php-fpm php-mysql php-cli php-curl git php-dev \
        php-mbstring php-intl mysql-server libcapnp-dev capnproto
unlink /etc/nginx/sites-enabled/default
cat > /etc/nginx/sites-available/sandstorm-php <<EOF
server {
    listen 8000 default_server;
    listen [::]:8000 default_server ipv6only=on;

    server_name localhost;
    root /opt/app;
    location / {
        index index.php;
        try_files \$uri \$uri/ =404;
    }
    location ~ \\.php\$ {
        fastcgi_pass unix:/var/run/php-fpm.sock;
        fastcgi_index index.php;
        fastcgi_split_path_info ^(.+\\.php)(/.+)\$;
        fastcgi_param  SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }
}
EOF
ln -sf /etc/nginx/sites-available/sandstorm-php /etc/nginx/sites-enabled/sandstorm-php
# service nginx stop
service php7.0-fpm stop
service mysqld stop
# systemctl disable nginx
systemctl disable php7.0-fpm
systemctl disable mysqld
# patch /etc/php/fpm/pool.d/www.conf to not change uid/gid to www-data
sed --in-place='' \
        --expression='s/^listen.owner = www-data/;listen.owner = www-data/' \
        --expression='s/^listen.group = www-data/;listen.group = www-data/' \
        --expression='s/^user = www-data/;user = www-data/' \
        --expression='s/^group = www-data/;group = www-data/' \
        --expression='s@^listen = /run/php/php7.0-fpm.sock@listen = /var/run/php-fpm.sock@' \
        /etc/php/7.0/fpm/pool.d/www.conf
# patch /etc/php/7.0/fpm/php-fpm.conf to not have a pidfile
sed --in-place='' \
        --expression='s/^pid =/;pid =/' \
        /etc/php/7.0/fpm/php-fpm.conf

sed --in-place='' \
        --expression='s/^pid =/;pid =/' \
        /etc/php/7.0/fpm/php-fpm.conf
# patch mysql conf to not change uid
sed --in-place='' \
        --expression='s/^user\t\t= mysql/#user\t\t= mysql/' \
        /etc/mysql/mariadb.conf.d/50-server.cnf
# patch mysql conf to use smaller transaction logs to save disk space
cat <<EOF > /etc/mysql/conf.d/sandstorm.cnf
[mysqld]
innodb_data_file_path = ibdata1:10M:autoextend
innodb_log_file_size = 10KB
innodb_file_per_table = 1
EOF
# patch nginx conf to not bother trying to setuid, since we're not root
# also patch errors to go to stderr, and logs nowhere.
sed --in-place='' \
        --expression 's/^user www-data/#user www-data/' \
        --expression 's#^pid /run/nginx.pid#pid /var/run/nginx.pid#' \
        --expression 's/^\s*error_log.*/error_log stderr;/' \
        --expression 's/^\s*access_log.*/access_log off;/' \
        /etc/nginx/nginx.conf
# Add a conf snippet providing what sandstorm-http-bridge says the protocol is as var fe_https
cat > /etc/nginx/conf.d/50sandstorm.conf << EOF
    # Trust the sandstorm-http-bridge's X-Forwarded-Proto.
    map \$http_x_forwarded_proto \$fe_https {
        default "";
        https on;
    }
EOF
# Adjust fastcgi_params to use the patched fe_https
sed --in-place='' \
        --expression 's/^fastcgi_param *HTTPS.*$/fastcgi_param  HTTPS               \$fe_https if_not_empty;/' \
        /etc/nginx/fastcgi_params
