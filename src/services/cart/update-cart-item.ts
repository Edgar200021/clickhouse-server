import type {User} from "@/types/db/user.js";
import type {UpdateCartItemRequest} from "@/schemas/cart/update-cart-item.schema.js";
import type {CartItemParam} from "@/schemas/cart/cart-item-param.schema.js";
import type {FastifyBaseLogger} from "fastify";
import {type CartService} from "@/services/cart/cart.service.js";

export async function updateCartItem(
	this: CartService,
	userId: User["id"],
	data: UpdateCartItemRequest,
	param: CartItemParam,
	log: FastifyBaseLogger,
) {
	const {fastify: {kysely, httpErrors}, getUserCart} = this

	const cart = await getUserCart(userId, {
		log,
		logMsg: "Update cart item failed: cart not found",
	});

	const row = await kysely
		.updateTable("cartItem")
		.where("cartId", "=", cart.id)
		.where("cartItem.id", "=", param.cartItemId)
		.set({
			quantity: data.quantity,
		})
		.returning("id")
		.executeTakeFirst();

	if (!row) {
		log.info(
			{cartItemId: param.cartItemId},
			"Update cart item failed: cart item not found",
		);
		throw httpErrors.notFound("Cart item not found");
	}
}