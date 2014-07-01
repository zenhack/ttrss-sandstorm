#!/bin/sh

cd /opt/app/
sleep 5 # wait for mysql
bash -c 'sleep 30 && /usr/bin/php5 /opt/app/update.php --feeds --force-update' 2>&1 &
php5 -S 0.0.0.0:33411 2>&1