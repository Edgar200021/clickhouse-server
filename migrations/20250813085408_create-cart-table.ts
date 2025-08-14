import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable("cart")
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
				.unique()
				.references("users.id")
				.onDelete("cascade")
				.onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createTable("cart_item")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("cart_id", "integer", (col) =>
			col
				.notNull()
				.references("cart.id")
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
		.addUniqueConstraint("cart_item_cart_id_product_sku_id_unique", [
			"cart_id",
			"product_sku_id",
		])
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("cart_item").execute();
	await db.schema.dropTable("cart").execute();
}
