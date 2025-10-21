import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable("product_sku")
		.addCheckConstraint("product_sku_quantity_positive", sql`quantity >= 0`)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable("product_sku")
		.dropConstraint("product_sku_quantity_positive")
		.execute();
}
