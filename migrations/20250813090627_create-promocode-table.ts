import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createType("promocode_type")
		.asEnum(["percent", "fixed"])
		.execute();

	await db.schema
		.createTable("promocode")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("code", "varchar(50)", (col) => col.notNull().unique())
		.addColumn("type", sql`promocode_type`, (col) => col.notNull())
		.addColumn("discount_value", sql`numeric(10,2)`, (col) => col.notNull())
		.addColumn("usage_limit", "integer", (col) => col.notNull())
		.addColumn("usage_count", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("valid_from", "timestamp", (col) => col.notNull())
		.addColumn("valid_to", "timestamp", (col) => col.notNull())
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("promocode").execute();
	await db.schema.dropType("promocode_type").execute();
}
