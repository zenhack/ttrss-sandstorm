# Use phusion/baseimage as base image. To make your builds reproducible, make
# sure you lock down to a specific version, not to `latest`!
# See https://github.com/phusion/baseimage-docker/blob/master/Changelog.md for
# a list of version numbers.
FROM phusion/baseimage:0.9.10

# Set correct environment variables.
ENV HOME /root

# Disable SSH
RUN rm -rf /etc/service/sshd /etc/my_init.d/00_regen_ssh_host_keys.sh

# Use baseimage-docker's init system.
CMD ["/sbin/my_init"]

RUN apt-get update

# Install Mysql
RUN apt-get -y install mysql-server

# Install php
RUN apt-get -y install php5 php5-mysql

# minimize mysql allocations
RUN echo '[mysqld]\ninnodb_data_file_path = ibdata1:10M:autoextend\ninnodb_log_file_size = 10KB\ninnodb_file_per_table = 1' > /etc/mysql/conf.d/small.cnf
RUN rm -rf /var/lib/mysql/* && mysql_install_db && chown -R mysql: /var/lib/mysql

# Setup mysql//mysql user
RUN /usr/sbin/mysqld & \
    sleep 10s &&\
    echo "GRANT ALL ON *.* TO mysql@'%' IDENTIFIED BY 'mysql' WITH GRANT OPTION; FLUSH PRIVILEGES; CREATE SCHEMA app;" | mysql

RUN mkdir /etc/service/mysql
ADD mysql.sh /etc/service/mysql/run

RUN mkdir /etc/service/php
ADD php.sh /etc/service/php/run

ADD . /opt/app
RUN rm -rf /opt/app/.git

RUN echo '*/30 * * * * root (/usr/bin/php5 /opt/app/update.php --feeds --force-update) >> /var/log/update_rss.log 2>&1' >> /etc/cron.d/update_rss

EXPOSE 33411

# Clean up APT when done.
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN rm -rf /usr/share/vim /usr/share/doc /usr/share/man /var/lib/dpkg /var/lib/belocs /var/lib/ucf /var/cache/debconf /var/log/*.log