import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createType("payment_status")
		.asEnum(["pending", "completed", "failed", "refunded"])
		.execute();

	await db.schema
		.createTable("payment")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("transaction_id", "text", (col) => col.notNull().unique())
		.addColumn("amount", "integer", (col) => col.notNull())
		.addColumn("status", sql`payment_status`, (col) =>
			col.notNull().defaultTo("pending"),
		)
		.addColumn("order_id", "integer", (col) =>
			col
				.notNull()
				.references("order.id")
				.onDelete("cascade")
				.onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createIndex("payment_order_id_idx")
		.on("payment")
		.column("order_id")
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropIndex("payment_order_id_idx").execute();
	await db.schema.dropTable("payment").execute();
	await db.schema.dropType("payment_status").execute();
}
