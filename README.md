# Clickhouse Server (Fastify API)

This is a Fastify-based backend service using PostgreSQL, Redis, Nodemailer, and Kysely ORM.

---



## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a .env or .env.test file based on your configuration:

```bash
APPLICATION_PORT = 4000
APPLICATION_HOST = 127.0.0.1
APPLICATION_CLIENTURL = 127.0.0.1
APPLICATION_CLIENT_ACCOUNT_VERIFICATION_PATH = "/verification-path"
APPLICATION_CLIENT_RESET_PASSWORD_PATH = "/reset-password-path"

RATE_LIMIT_GLOBAL = 100
RATE_LIMIT_NOT_FOUND = 5
RATE_LIMIT_SIGN_UP = 5

DATABASE_NAME = testdb
DATABASE_HOST = localhost
DATABASE_PORT = 5432
DATABASE_USER = postgres
DATABASE_PASSWORD = password
DATABASE_SSL = false
DATABASE_POOL_MIN = 2
DATABASE_POOL_MAX = 10
DATABASE_URL = postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}

REDIS_HOST = 127.0.0.1
REDIS_PORT = 6379
REDIS_PASSWORD = your_redis_password

LOG_TO_FILE = false
LOG_INFO_PATH = /home/user/logs/info.log
LOG_WARN_PATH = /home/user/logs/warn.log
LOG_ERROR_PATH = /home/user/logs/error.log
LOG_LEVEL = info

NODEMAILER_HOST = smtp.gmail.com
NODEMAILER_PORT = 465
NODEMAILER_SECURE = true
NODEMAILER_USER = your_email@gmail.com
NODEMAILER_PASSWORD = your_email_password

VERIFICATION_TOKEN_TTL_MINUTES = 1440
```

### 3. Start development server

```bash
npm run dev
```

## Run with Docker

Start services (API, PostgreSQL, Redis)

```bash
npm run docker:compose:up
```

Stop and clean up

```bash
npm run docker:compose:down
```

## Database Migrations

Apply latest migrations

```bash
npm run migration:run
```

Create new migration

```bash
npm run migration:create
```

Rollback all migrations

```bash
npm run migration:rollback
```

List migrations

```bash
npm run migration:list
```

### Kysely Code Generation

Generate TypeScript types from your database schema

```bash
npm run kysely:codegen
```

### Testing

Run tests

```bash
npm run test
```

Run tests with coverage

```bash
npm run test:coverage
```

### Build for Production

Build the project

```bash
npm run build
```

Start the built app

```bash
npm run start
```
