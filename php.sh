#!/bin/sh

cd /opt/app/
sleep 5 # wait for mysql
exec php5 -S 0.0.0.0:33411 >>/var/log/php.log 2>&1