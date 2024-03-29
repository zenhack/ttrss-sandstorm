#!/bin/bash

set -euo pipefail


# Install mysql 5.5 from nix, for upgrading old grains:
if [ ! -d /nix/store ]; then
	# Install a version of nix that is old enough to work
	# with the even-older version of nixpkgs that shipped
	# mysql 5.5. The logic was worked out by reading the
	# install script normally piped into bash; we can't just
	# do that because it will give us the newest version.
	nix_version=2.3
	nix_url="https://releases.nixos.org/nix/nix-${nix_version}/nix-${nix_version}-x86_64-linux.tar.xz"
	curl -L "$nix_url" -o nix.tar.xz
	mkdir nix-unpack
	cd nix-unpack
	tar -xf ../nix.tar.xz
	./*/install --no-daemon
fi
. /home/vagrant/.nix-profile/etc/profile.d/nix.sh
cd /home/vagrant
if [ ! -d nixpkgs ]; then
	git clone https://github.com/nixos/nixpkgs
	cd nixpkgs
	# Last version of nixpkgs that shipped mysql 5.5
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

cd /opt/app/.sandstorm/apphooks
go build
