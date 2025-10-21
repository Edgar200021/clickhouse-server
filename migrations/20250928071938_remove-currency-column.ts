import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable("product_sku").dropColumn("currency").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable("product_sku")
		.addColumn("currency", sql`currency`, (col) =>
			col.notNull().defaultTo("RUB"),
		)
		.execute();
}
