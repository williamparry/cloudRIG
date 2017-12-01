# Electron

## Dev mode

	electron .

Uses index.js, which has fake AWS credentials that you can change in index.js.

## Build/publish mode

Use the gui/package.json scripts; it will replace index.js with index.prod.js, which will use real AWS credentials.