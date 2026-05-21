#!/usr/bin/env bash
# Verify IMS modules 7–26 (API integration tests).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

echo "==> Running modules 7–26 integration tests..."
python manage.py test apps.tests.test_modules_7_26 --verbosity=2

echo ""
echo "==> All module verification tests passed."
