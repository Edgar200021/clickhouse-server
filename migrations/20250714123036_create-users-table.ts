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
			col.notNull().defaultTo("now()"),
		)
		.addColumn("updated_at", "timestamp", (col) =>
			col.notNull().defaultTo("now()"),
		)
		.addColumn("email", "text", (col) => col.notNull().unique())
		.addColumn("password", "text", (col) => col.notNull())
		.addColumn("first_name", "text")
		.addColumn("last_name", "text")
		.addColumn("role", sql`user_role`, (col) =>
			col.notNull().defaultTo("regular"),
		)
		.addColumn("is_verified", "boolean", (col) =>
			col.notNull().defaultTo(false),
		)
		.addColumn("is_banned", "boolean", (col) => col.notNull().defaultTo(false))
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("users").execute();
	await db.schema.dropType("user_role").execute();

	await sql`DROP EXTENSION IF EXISTS pgcrypto`.execute(db);
}
