#!/bin/bash

# Create android/app folder if it doesn't exist
mkdir -p app

# Decode the GOOGLE_SERVICES_JSON secret back into google-services.json
echo $GOOGLE_SERVICES_JSON | base64 --decode > ./app/google-services.json

echo "✅ google-services.json created in android/app/"
