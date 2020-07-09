Tiny Tiny RSS
=============

Web-based news feed aggregator, designed to allow you to read news from
any location, while feeling as close to a real desktop application as possible.

http://tt-rss.org

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

Copyright (c) 2005 Andrew Dolgov (unless explicitly stated otherwise).

Uses Silk icons by Mark James: http://www.famfamfam.com/lab/icons/silk/

## Sandstorm

This Sandstorm app uses docker to build it's package.

* You must have docker v1.1+ installed.
* First run `docker build -t tinytinyrss .` to build the docker image
* Then you will need to run the image with `docker run -p 33411:33411 --dns='127.0.0.1' -i -t tinytinyrss /sbin/my_init -- /bin/bash`
* Vist the app in your browser by going to http://localhost:33411 and follow the setup instructions. The mysql username is `mysql` and the password is `mysql`, and the database name should be `app`.
* Exit this image after it has booted up and run the app successfully. Then run `./export_docker.sh` from this directory to export the last run docker container into a folder named `dockerenv`.
* Once this is done, `spk dev` and `spk pack` should now work like normal

