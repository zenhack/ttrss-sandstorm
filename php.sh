#!/bin/sh

cd /opt/app/
sleep 5 # wait for mysql
bash -c 'sleep 30 && /usr/bin/php /opt/app/update.php --feeds' 2>&1 &
php5 -S 0.0.0.0:33411 2>&1