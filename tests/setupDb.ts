import {Config} from "../src/config.js";
import pg from "pg";
import {CamelCasePlugin, Kysely, type Migration, Migrator, PostgresDialect} from "kysely";
import type {DB} from "../src/types/db/db.js";
import path from "node:path";
import {promises as fs} from "fs";
import {promisify} from "node:util";
import {exec} from "node:child_process";
import ts from "ts-node";

const execAsync = promisify(exec);

ts.register({
	transpileOnly: true,
});

const runSeed = async (databaseUrl?: string) => {
	const {stderr} = await execAsync("npm run seed:run", {
		env: {
			...process.env,
			DATABASE_URL: databaseUrl || process.env.DATABASE_URL,
		},
	});
	if (stderr) {
		throw new Error(`Seed error: ${stderr}`);
	}
}


export const setupDb = async (config: Config["database"]) => {
	const removeDb = async () => {
		try {
			const adminPool = new pg.Pool({
				host: config.host,
				port: config.port,
				user: config.user,
				password: config.password,
				database: "postgres",
			});

			const adminClient = await adminPool.connect();

			await adminClient.query(`DROP DATABASE IF EXISTS "${config.name}"`);
			adminClient.release();
			await adminPool.end();

			console.log(`🗑 Database "${config.name}" removed successfully.`);
		} catch (err) {
			console.error(`Failed to remove database "${config.name}"`, err);
		}
	}


	try {
		const adminPool = new pg.Pool({
			host: config.host,
			port: config.port,
			user: config.user,
			password: config.password,
			database: "postgres"
		});

		const adminClient = await adminPool.connect();
		const res = await adminClient.query(`SELECT 1
                                         FROM pg_database
                                         WHERE datname = $1`, [config.name]);
		if (res.rowCount === 0) {
			await adminClient.query(`CREATE DATABASE "${config.name}"`);
		}


		adminClient.release();
		await adminPool.end();

		const pool = new pg.Pool({
			host: config.host,
			port: config.port,
			user: config.user,
			password: config.password,
			database: config.name
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
						const {up, down} = await import(importPath);
						const migrationKey = fileName.substring(
							0,
							fileName.lastIndexOf("."),
						);

						migrations[migrationKey] = {up, down};
					}

					return migrations;
				},
			},
		});

		const {error} = await migrator.migrateToLatest();

		if (error) {
			console.error("Failed to run migrations", error);
			throw error;
		}


		await db.destroy();
		await runSeed(`postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.name}`)

		console.log("🎉 All migrations applied successfully.");

		return {
			removeDb
		};
	} catch (error) {
		await removeDb()
		console.error("Failed to apply migrations", error);
		process.exit(1);
	}
}