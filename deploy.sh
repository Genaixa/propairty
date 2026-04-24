#!/bin/bash
# PropAIrty frontend deploy script
# Run after making frontend changes: ./deploy.sh

set -e

echo "Building frontend..."
cd /root/propairty/frontend
npm run build

echo "Deploying to /var/www/propairty..."
rsync -a --delete /root/propairty/frontend/dist/ /var/www/propairty/

echo "Restarting backend..."
sudo systemctl restart propairty.service

echo "Done. Site updated at https://propairty.co.uk"
