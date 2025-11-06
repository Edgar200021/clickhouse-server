lsset -x
set -eo pipefail

if ! [ -x "$(command -v psql)" ]; then
    echo >&2 "Error: psql is not installed."
    exit 1
fi

if ! [ -x "$(command -v kysely)" ]; then
    echo >&2 "Error: kysely is not installed."
    echo >&2 "Use:"
    echo >&2 "npm install -g kysely-ctl@0.14.0"
    echo >&2 "to install it."
    exit 1
fi

DB_HOST=${POSTGRES_HOST:=localhost}
DB_USER=${POSTGRES_USER:=postgres}
DB_PASSWORD="${POSTGRES_PASSWORD:=password}"
DB_NAME="${POSTGRES_DB:=clickhouse}"
DB_PORT="${POSTGRES_PORT:=5432}"

if [[ -z "${SKIP_DOCKER}" ]]
then
    docker run \
    -e POSTGRES_USER=${DB_USER} \
    -e POSTGRES_PASSWORD=${DB_PASSWORD} \
    -e POSTGRES_DB=${DB_NAME} \
    -p "${DB_PORT}":5432 \
    -d postgres \
    postgres -N 1000
fi

export PGPASSWORD="${DB_PASSWORD}"
until psql -h "${DB_HOST}" -U "${DB_USER}" -p "${DB_PORT}" -d "postgres" -c '\q'; do
    >&2 echo "Postgres is still unavailable - sleeping"
    sleep 1
done

>&2 echo "Postgres is up and running on ${DB_HOST}:${DB_PORT}!"

export DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
kysely migrate:latest

>&2 echo "Postgres has been migrated, ready to go!"
