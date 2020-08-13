#!/bin/bash

set -euo pipefail

# Install mysql 5.5 from nix, for upgrading old grains:
if [ ! -d /nix/store ]; then
	sh <(curl -L https://nixos.org/nix/install) --no-daemon
fi
. /home/vagrant/.nix-profile/etc/profile.d/nix.sh
cd /home/vagrant
if [ ! -d nixpkgs ]; then
	git clone https://github.com/nixos/nixpkgs
	cd nixpkgs
	git checkout 880bc93fc0ad44ea5b973e532c338afeb70d2a71
fi
sudo ln -sf \
	$(nix-shell \
		-p mysql55 \
		-I nixpkgs=$HOME/nixpkgs \
		--command 'dirname $(dirname $(which mysqlcheck))' \
	) \
	/usr/local/mysql55


cd /opt/app/.sandstorm/powerbox-http-proxy
go build
npm install
npm run build

cd /opt/app/.sandstorm/apphooks
go build
