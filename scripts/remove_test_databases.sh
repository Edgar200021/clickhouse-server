#!/bin/bash

if ! command -v psql &> /dev/null
then
    echo "❌ psql not found. Please install PostgreSQL client."
    exit 1
fi

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
export PGPASSWORD

DBS=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'test-%';" | xargs)

if [ -z "$DBS" ]; then
    echo "ℹ️ No test databases found."
    exit 0
fi

count=0
for db in $DBS; do
    if [ -n "$db" ]; then
        echo "🗑 Dropping database: $db"
        psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -c "DROP DATABASE IF EXISTS \"$db\";"
        ((count++))
    fi
done

echo "✅ Total databases removed: $count"