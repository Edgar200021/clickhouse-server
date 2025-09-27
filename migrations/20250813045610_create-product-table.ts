import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`CREATE EXTENSION IF NOT EXISTS hstore`.execute(db);
	await db.schema
		.createType("currency")
		.asEnum(["RUB", "USD", "EUR"])
		.execute();

	await db.schema
		.createTable("product")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("description", "text", (col) => col.notNull())
		.addColumn("short_description", "text", (col) => col.notNull())
		.addColumn("materials_and_care", "text", (col) => col.notNull())
		.addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("assembly_instruction_file_id", "text")
		.addColumn("assembly_instruction_file_url", "text")
		.addColumn("category_id", "integer", (col) =>
			col.references("category.id").onUpdate("cascade").onDelete("set null"),
		)
		.addColumn("manufacturer_id", "integer", (col) =>
			col
				.notNull()
				.references("manufacturer.id")
				.onUpdate("cascade")
				.onDelete("set default")
				.defaultTo(1),
		)
		.execute();

	await db.schema
		.createTable("product_sku")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("sku", "text", (col) => col.notNull().unique())
		.addColumn("quantity", "integer", (col) => col.notNull())
		.addColumn("currency", sql`currency`, (col) =>
			col.notNull().defaultTo("RUB"),
		)
		.addColumn("price", "integer", (col) => col.notNull())
		.addColumn("sale_price", "integer")
		.addColumn("attributes", sql`hstore`, (col) => col.notNull())
		.addColumn("product_id", "integer", (col) =>
			col
				.notNull()
				.references("product.id")
				.onUpdate("cascade")
				.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.createTable("product_sku_package")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("quantity", "integer", (col) => col.notNull())
		.addColumn("width", "double precision", (col) => col.notNull())
		.addColumn("height", "double precision", (col) => col.notNull())
		.addColumn("length", "double precision", (col) => col.notNull())
		.addColumn("weight", "double precision", (col) => col.notNull())
		.addColumn("product_sku_id", "integer", (col) =>
			col
				.notNull()
				.references("product_sku.id")
				.onUpdate("cascade")
				.onDelete("cascade"),
		)
		.addUniqueConstraint(
			"product_sku_package_product_sku_id_width_height_length_weight_unique",
			["product_sku_id", "width", "height", "length", "weight"],
		)
		.execute();

	await db.schema
		.createTable("product_sku_images")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("image_id", "text", (col) => col.notNull())
		.addColumn("image_url", "text", (col) => col.notNull())
		.addColumn("product_sku_id", "integer", (col) =>
			col
				.notNull()
				.references("product_sku.id")
				.onUpdate("cascade")
				.onDelete("cascade"),
		)
		.addUniqueConstraint("product_sku_images_product_sku_id_image_id_unique", [
			"product_sku_id",
			"image_id",
		])
		.execute();

	await sql`
  CREATE UNIQUE INDEX product_sku_unique_attrs ON product_sku (
    product_id,
    (attributes -> 'color'),
    (attributes -> 'height'),
    (attributes -> 'width'),
    (attributes -> 'length')
  )`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("product_sku_images").execute();
	await db.schema.dropTable("product_sku_package").execute();
	await db.schema.dropTable("product_sku").execute();
	await db.schema.dropTable("product").execute();
	await db.schema.dropType("currency").execute();
	await sql`DROP EXTENSION IF EXISTS hstore`.execute(db);
}
