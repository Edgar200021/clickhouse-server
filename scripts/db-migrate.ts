import "dotenv/config";

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CamelCasePlugin, Kysely, Migrator, PostgresDialect } from "kysely";
import pg from "pg";
import type { Config } from "../src/config.js";
import type { DB } from "../src/types/db/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import type { Migration } from "kysely";
import ts from "ts-node";

ts.register({
	transpileOnly: true,
});

export async function dbMigrate(config?: Config["database"]) {
	const dbName = config?.name || process.env.DATABASE_NAME;

	if (!dbName) {
		throw new Error("DATABASE_NAME is not defined");
	}

	try {
		const pool = new pg.Pool({
			database: dbName,
			host: config?.host || process.env.DATABASE_HOST,
			port: config?.port || Number(process.env.DATABASE_PORT),
			user: config?.user || process.env.DATABASE_USER,
			password: config?.password || process.env.DATABASE_PASSWORD,
		});

		const db = new Kysely<DB>({
			dialect: new PostgresDialect({
				pool: pool,
			}),
			plugins: [new CamelCasePlugin()],
		});

		const absolutePath = path.join(__dirname, "..", "migrations");
		const migrator = new Migrator({
			db,
			provider: {
				async getMigrations(): Promise<Record<string, Migration>> {
					const migrations: Record<string, Migration> = {};
					const files = await fs.readdir(absolutePath);

					for (const fileName of files) {
						if (!fileName.endsWith(".ts")) {
							continue;
						}

						const importPath = path
							.join(absolutePath, fileName)
							.replaceAll("\\", "/");
						const { up, down } = await import(importPath);
						const migrationKey = fileName.substring(
							0,
							fileName.lastIndexOf("."),
						);

						migrations[migrationKey] = { up, down };
					}

					return migrations;
				},
			},
		});

		const { error, results } = await migrator.migrateToLatest();

		if (error) {
			console.error("Failed to run migrations", error);
			throw error;
		}

		for (const result of results ?? []) {
			if (result.status === "Success") {
				console.log(`✅ Migration "${result.migrationName}" applied`);
			} else if (result.status === "Error") {
				console.error(`❌ Failed on migration "${result.migrationName}"`);
			}
		}

		await db.destroy();
		console.log("🎉 All migrations applied successfully.");
	} catch (error) {
		console.error("Failed to apply migrations", error);
		process.exit(1);
	}
}
