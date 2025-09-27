import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable("cart")
		.addColumn("promocode_id", "integer", (col) =>
			col.references("promocode.id").onDelete("set null").onUpdate("cascade"),
		)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable("cart").dropColumn("promocode_id").execute();
}
