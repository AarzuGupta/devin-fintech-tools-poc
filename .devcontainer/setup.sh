#!/usr/bin/env bash
# Codespaces setup: install, create .env with a fresh random session secret,
# seed the synthetic SQLite database, and build the production app.
set -euo pipefail
npm ci
if [ ! -f .env ]; then
  cp .env.example .env
  secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=\"${secret}\"/" .env
fi
npm run setup
npm run build
