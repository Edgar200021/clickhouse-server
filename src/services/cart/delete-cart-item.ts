import type {User} from "@/types/db/user.js";
import type {CartItemParam} from "@/schemas/cart/cart-item-param.schema.js";
import type {FastifyBaseLogger} from "fastify";
import {type CartService} from "@/services/cart/cart.service.js";

export async function deleteCartItem(
	this: CartService,
	userId: User["id"],
	param: CartItemParam,
	log: FastifyBaseLogger,
) {
	const {fastify: {kysely, httpErrors}, getUserCart} = this

	const cart = await getUserCart(userId, {
		log,
		logMsg: "Delete cart item failed: cart not found",
	});

	const row = await kysely
		.deleteFrom("cartItem")
		.where("cartId", "=", cart.id)
		.where("cartItem.id", "=", param.cartItemId)
		.returning("id")
		.executeTakeFirst();

	if (!row) {
		log.info(
			{cartItemId: param.cartItemId},
			"Delete cart item failed: cart item not found",
		);
		throw httpErrors.notFound("Cart item not found");
	}
}