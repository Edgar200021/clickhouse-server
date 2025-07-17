import pg from "pg";
import type { Config } from "../src/config.js";

export async function dbDelete(config?: Config["database"]) {
	const dbName = config?.name || process.env.DATABASE_NAME;

	if (!dbName) {
		throw new Error("DATABASE_NAME is not defined");
	}

	try {
		const client = new pg.Client({
			database: "postgres",
			host: config?.host || process.env.DATABASE_HOST,
			port: config?.port || Number(process.env.DATABASE_PORT),
			user: config?.user || process.env.DATABASE_USER,
			password: config?.password || process.env.DATABASE_PASSWORD,
		});

		await client.connect();

		const res = await client.query(
			`SELECT 1 FROM pg_database WHERE datname = $1`,
			[dbName],
		);

		if (res.rowCount && res.rowCount > 0) {
			const safeDbName = `"${dbName.replace(/"/g, '""')}"`;
			await client.query(`DROP DATABASE ${safeDbName};`);
		}

		await client.end();
	} catch (error) {
		console.error("Failed to delete database", error);
		process.exit(1);
	}
}
