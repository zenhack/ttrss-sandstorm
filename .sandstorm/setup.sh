#!/bin/bash

# When you change this file, you must take manual action. Read this doc:
# - https://docs.sandstorm.io/en/latest/vagrant-spk/customizing/#setupsh

set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

# Install Go, for the powerbox server:
curl -sL https://dl.google.com/go/go1.19.linux-amd64.tar.gz -o /usr/local/go.tar.gz
(cd /usr/local && tar -xvf go.tar.gz)
cat > /etc/profile.d/go.sh <<"EOF"
export PATH="$PATH:/usr/local/go/bin"
EOF

# Install node, to build the client-side part of the powerbox server:
apt-get update
apt-get install -y apt-transport-https
curl -sL https://deb.nodesource.com/setup_16.x | bash -

echo -e "deb http://repo.mysql.com/apt/debian/ buster mysql-5.7\ndeb-src http://repo.mysql.com/apt/debian/ buster mysql-5.7" > /etc/apt/sources.list.d/mysql.list
wget -O /tmp/RPM-GPG-KEY-mysql https://repo.mysql.com/RPM-GPG-KEY-mysql-2022
apt-key add /tmp/RPM-GPG-KEY-mysql

apt-get update
apt-get install -y \
	git \
	mysql-server \
	nginx \
	nodejs \
	\
	php-cli \
	php-curl \
	php-dev \
	php-fpm \
	php-intl \
	php-mbstring \
	php-mysql
service nginx stop
service php7.3-fpm stop
service mysql stop
systemctl disable nginx
systemctl disable php7.3-fpm
systemctl disable mysql
# patch /etc/php/7.3/fpm/pool.d/www.conf to not change uid/gid to www-data
sed --in-place='' \
        --expression='s/^listen.owner = www-data/;listen.owner = www-data/' \
        --expression='s/^listen.group = www-data/;listen.group = www-data/' \
        --expression='s/^user = www-data/;user = www-data/' \
        --expression='s/^group = www-data/;group = www-data/' \
        /etc/php/7.3/fpm/pool.d/www.conf
# patch /etc/php/7.3/fpm/php-fpm.conf to not have a pidfile
sed --in-place='' \
        --expression='s/^pid =/;pid =/' \
        /etc/php/7.3/fpm/php-fpm.conf
# patch /etc/php/7.3/fpm/php-fpm.conf to place the sock file in /var
sed --in-place='' \
       --expression='s/^listen = \/run\/php\/php7.3-fpm.sock/listen = \/var\/run\/php\/php7.3-fpm.sock/' \
        /etc/php/7.3/fpm/pool.d/www.conf
# patch /etc/php/7.3/fpm/pool.d/www.conf to no clear environment variables
# so we can pass in SANDSTORM=1 to apps
sed --in-place='' \
        --expression='s/^;clear_env = no/clear_env=no/' \
        /etc/php/7.3/fpm/pool.d/www.conf
# patch mysql conf to not change uid, and to use /var/tmp over /tmp
# for secure-file-priv see https://github.com/sandstorm-io/vagrant-spk/issues/195
sed --in-place='' \
        --expression='s/^user\t\t= mysql/#user\t\t= mysql/' \
        --expression='s,^tmpdir\t\t= /tmp,tmpdir\t\t= /var/tmp,' \
        --expression='/\[mysqld]/ a\ secure-file-priv = ""\' \
        /etc/mysql/my.cnf
# patch mysql conf to use smaller transaction logs to save disk space
cat <<EOF > /etc/mysql/conf.d/sandstorm.cnf
[mysqld]
# Set the transaction log file to the minimum allowed size to save disk space.
innodb_log_file_size = 1048576
# /tmp is small; use /var/tmp so we don't run out of space:
tmpdir = /var/tmp
# Set the main data file to grow by 1MB at a time, rather than 8MB at a time.
innodb_autoextend_increment = 1
EOF
