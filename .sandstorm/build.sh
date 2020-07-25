#!/bin/bash

set -euo pipefail

cd /opt/app/.sandstorm/powerbox

cd server
go build

cd ../client
npm install
npm run build

cd /opt/app/.sandstorm/apphooks
go build
