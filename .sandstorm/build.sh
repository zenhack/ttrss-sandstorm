#!/bin/bash

set -euo pipefail

cd /opt/app/.sandstorm/powerbox-http-proxy
go build
npm install
npm run build

cd /opt/app/.sandstorm/apphooks
go build
