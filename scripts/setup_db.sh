#!/bin/bash
set -e

DB_NAME="bible-books-tracker"
DB_USER="postgres"
DB_PASS="pass"

echo "Setting up PostgreSQL..."

# Create the postgres role with superuser if it doesn't exist
psql postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  && echo "Role '$DB_USER' already exists." \
  || psql postgres -c "CREATE ROLE $DB_USER WITH LOGIN SUPERUSER PASSWORD '$DB_PASS';"

# Create the database if it doesn't exist
psql postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  && echo "Database '$DB_NAME' already exists." \
  || psql postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER $DB_USER;"

echo "Done. You can now run: python3 backend/src/routes.py"
