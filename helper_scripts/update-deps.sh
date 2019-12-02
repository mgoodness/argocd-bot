#!/usr/bin/env bash

npm install  npm-check-updates
./node_modules/.bin/ncu -u
npm install
npm audit fix
