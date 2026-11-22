#!/usr/bin/env bash
set -o errexit
pip install -r requirements.txt
python manage.py collectstatic --no-input
# Creates the core app's tables even when migration files were not committed.
python manage.py makemigrations core --no-input
python manage.py migrate --no-input
