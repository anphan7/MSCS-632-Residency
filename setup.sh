#!/usr/bin/env bash
# One-shot installer for all three components.
# Prereqs: Node.js 18+ and a JDK 17+ (see REQUIREMENTS.md).
set -e
cd "$(dirname "$0")"

echo "==> Installing frontend dependencies..."
(cd frontend && npm install)

echo "==> Installing Node backend dependencies..."
(cd backend-node && npm install)

echo "==> Building Java backend (downloads Gradle + deps on first run)..."
(cd backend-java && ./gradlew build -x test)

echo ""
echo "Done. See the README for how to run each part."
