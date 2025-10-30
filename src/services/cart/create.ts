import type {User} from "@/types/db/user.js";
import type {DB} from "@/types/db/db.js";
import {Transaction} from "kysely";
import {type CartService} from "@/services/cart/cart.service.js";

export async function createIfNotExists(
	this: CartService,
	user: Pick<User, "id">,
	trx?: Transaction<DB>,
	shouldThrow?: boolean,
) {
	const result = await (trx ?? this.fastify.kysely)
		.insertInto("cart")
		.values({userId: user.id})
		.onConflict((oc) => oc.column("userId").doNothing())
		.executeTakeFirst();

	if (shouldThrow && !result.numInsertedOrUpdatedRows) {
		throw new Error("Cart already exists for this user");
	}
}