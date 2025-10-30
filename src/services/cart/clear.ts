import {User} from "@/types/db/user.js";
import {FastifyBaseLogger} from "fastify";
import {type CartService} from "@/services/cart/cart.service.js";

export async function clearCart(this: CartService, userId: User["id"], log: FastifyBaseLogger) {
	const cart = await this.getUserCart(userId, {
		log,
		logMsg: "Clear cart failed: cart not found",
	});

	if (!cart) {
		log.info({userId}, "Clear cart failed: cart not found");
		throw this.fastify.httpErrors.notFound("Cart not found");
	}

	await this.fastify.kysely
		.deleteFrom("cartItem")
		.where("cartId", "=", cart.id)
		.returning("id")
		.executeTakeFirst();
}