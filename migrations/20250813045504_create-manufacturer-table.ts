import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable("manufacturer")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("name", "text", (col) => col.notNull().unique())
		.execute();

	await db
		.insertInto("manufacturer")
		.values({
			name: "clickhouse",
		})
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("manufacturer").execute();
}
