import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

	await db.schema
		.createType("user_role")
		.asEnum(["admin", "regular"])
		.execute();

	await db.schema
		.createTable("users")
		.addColumn("id", "uuid", (col) =>
			col.primaryKey().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn("created_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("email", "text", (col) => col.unique().notNull())
		.addColumn("password", "text")
		.addColumn("role", sql`user_role`, (col) =>
			col.notNull().defaultTo("regular"),
		)
		.addColumn("is_verified", "boolean", (col) =>
			col.notNull().defaultTo(false),
		)
		.addColumn("is_banned", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("google_id", "text", (col) => col.unique())
		.addColumn("facebook_id", "text", (col) => col.unique())
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("users").execute();
	await db.schema.dropType("user_role").execute();
	await sql`DROP EXTENSION IF EXISTS pgcrypto`.execute(db);
}
