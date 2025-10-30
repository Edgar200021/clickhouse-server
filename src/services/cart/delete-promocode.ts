import {type CartService} from "@/services/cart/cart.service.js";
import {User} from "@/types/db/user.js";
import {FastifyBaseLogger} from "fastify";
import {Transaction} from "kysely";
import {DB} from "@/types/db/db.js";

export async function deletePromocode(
	this: CartService,
	userId: User["id"],
	log: FastifyBaseLogger,
	trx?: Transaction<DB>,
) {
	const {fastify: {httpErrors, kysely}, getUserCart} = this

	const cart = await getUserCart(userId, {
		log,
		logMsg: "Delete cart promocode failed: cart not found",
	});

	if (!cart.promocodeId) {
		log.info(
			{userId},
			"Delete cart promocode failed: cart doesn't have a promocode",
		);
		throw httpErrors.badRequest("Cart doesn't have a promocode");
	}

	await (trx ?? kysely)
		.updateTable("cart")
		.set({promocodeId: null})
		.where("id", "=", cart.id)
		.execute();
}