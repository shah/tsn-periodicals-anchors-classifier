# Periodicals Links Classifier

Detect anchors (links) in periodicals (newsletters, tweets, etc.) and classify them as content or non-content

# Dependencies

* NodeJS 14+ with TypeScript 3.9+

# One-time Setup

    npm login --registry=https://npm.pkg.github.com
    npm install

# Testing

    gunzip --keep email-supplier-test-content.json.gz
    npm test