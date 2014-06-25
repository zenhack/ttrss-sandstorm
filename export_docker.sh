#!/bin/bash
rm -rf dockerenv
mkdir dockerenv && cd dockerenv

docker export `docker ps -l -q` | tar x

mv var var_original
rm -rf etc/service/*/supervise

cd var_original
rm lock run
rm -f ../run/crond.reboot
cp -r ../run .
ln -s run/lock lock
cd ..

cd opt
rm -rf app/.git
cp app/sandstorm/bin/* ../bin
cp app/config.php-sandstorm app/config.php
cd ../..

cp my_init dockerenv/sbin/
