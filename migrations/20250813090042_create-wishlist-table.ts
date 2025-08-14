import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable("wishlist")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("user_id", "uuid", (col) =>
			col
				.notNull()
				.references("users.id")
				.onDelete("cascade")
				.onUpdate("cascade"),
		)
		.addColumn("product_sku_id", "integer", (col) =>
			col
				.notNull()
				.references("product_sku.id")
				.onDelete("cascade")
				.onUpdate("cascade"),
		)
		.addUniqueConstraint("wishlist_user_id_product_sku_id_unique", [
			"user_id",
			"product_sku_id",
		])
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("wishlist").execute();
}
