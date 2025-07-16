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
