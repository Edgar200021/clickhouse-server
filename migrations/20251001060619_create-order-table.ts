import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createType("order_status")
		.asEnum(["pending", "paid", "shipped", "delivered", "cancelled"])
		.execute();

	await db.schema
		.createTable("order")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("number", "uuid", (col) =>
			col.notNull().defaultTo(sql`gen_random_uuid()`),
		)
		.addColumn("total", "integer", (col) => col.notNull())
		.addColumn("currency", sql`currency`, (col) => col.notNull())
		.addColumn("status", sql`order_status`, (col) =>
			col.notNull().defaultTo("pending"),
		)
		.addColumn("phone_number", "text", (col) => col.notNull())
		.addColumn("email", "text", (col) => col.notNull())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("billing_address_city", "text", (col) => col.notNull())
		.addColumn("billing_address_street", "text", (col) => col.notNull())
		.addColumn("billing_address_home", "text", (col) => col.notNull())
		.addColumn("billing_address_apartment", "text", (col) => col.notNull())
		.addColumn("delivery_address_city", "text", (col) => col.notNull())
		.addColumn("delivery_address_street", "text", (col) => col.notNull())
		.addColumn("delivery_address_home", "text", (col) => col.notNull())
		.addColumn("delivery_address_apartment", "text", (col) => col.notNull())
		.addColumn("user_id", "uuid", (col) =>
			col
				.notNull()
				.references("users.id")
				.onDelete("cascade")
				.onUpdate("cascade"),
		)
		.addColumn("promocode_id", "integer", (col) =>
			col.references("promocode.id").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createTable("order_item")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("price", "integer", (col) => col.notNull())
		.addColumn("quantity", "integer", (col) => col.notNull())
		.addColumn("order_id", "integer", (col) =>
			col
				.notNull()
				.references("order.id")
				.onDelete("cascade")
				.onUpdate("cascade"),
		)
		.addColumn("product_sku_id", "integer", (col) =>
			col.notNull().references("product_sku.id").onUpdate("cascade"),
		)

		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("order_item").execute();
	await db.schema.dropTable("order").execute();
	await db.schema.dropType("order_status").execute();
}
