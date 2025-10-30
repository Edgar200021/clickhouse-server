import type {User} from "@/types/db/user.js";
import type {AddCartItemRequest} from "@/schemas/cart/add-cart-item.schema.js";
import type {FastifyBaseLogger} from "fastify";
import {MaxCartItemCount} from "@/const/const.js";
import {isDatabaseError} from "@/types/db/error.js";
import {ForeignKeyConstraintCode} from "@/const/database.js";
import {type CartService} from "@/services/cart/cart.service.js";

export async function addCartItem(
	this: CartService,
	userId: User["id"],
	data: AddCartItemRequest,
	log: FastifyBaseLogger,
) {
	const {fastify: {httpErrors, kysely}, getUserCart, calculateCartInfo} = this

	try {
		const cart = await getUserCart(userId, {
			log,
			logMsg: "Add cart item failed: cart not found",
		});

		if (!cart) {
			log.info({userId}, "Add cart item failed: cart not found");
			throw httpErrors.notFound("Cart not found");
		}

		const {count} = await calculateCartInfo<"count">(userId);
		if (count >= MaxCartItemCount) {
			log.info({userId}, "Add cart item failed: сart item limit exceeded");
			throw httpErrors.badRequest("Cart item limit exceeded");
		}

		await kysely
			.insertInto("cartItem")
			.values({
				cartId: cart.id,
				quantity: data.quantity,
				productSkuId: data.productSkuId,
			})
			.onConflict((oc) =>
				oc
					.columns(["cartId", "productSkuId"])
					.doUpdateSet({quantity: data.quantity}),
			)
			.execute();
	} catch (err) {
		if (
			isDatabaseError(err) &&
			err.code === ForeignKeyConstraintCode &&
			err.detail.includes("product_sku_id")
		) {
			log.info(
				{productSkuId: data.productSkuId},
				"Add cart item failed: product sku not found",
			);
			throw httpErrors.notFound("Product sku not found");
		}

		throw err;
	}
}