import fp from "fastify-plugin"
import {type FastifyBaseLogger, FastifyInstance} from "fastify";
import type {User} from "@/types/db/user.js";
import {Currency} from "@/types/db/db.js";
import type {Cart} from "@/types/db/cart.js";
import {getCart} from "@/services/cart/get-cart.js";
import {createIfNotExists} from "@/services/cart/create.js";
import {clearCart} from "@/services/cart/clear.js";
import {deleteCartItem} from "@/services/cart/delete-cart-item.js";
import {updateCartItem} from "@/services/cart/update-cart-item.js";
import {addCartItem} from "@/services/cart/add-cart-item.js";
import {deletePromocode} from "@/services/cart/delete-promocode.js";
import {addPromocode} from "@/services/cart/add-promocode.js";


declare module "fastify" {
	export interface FastifyInstance {
		cartService: CartService
	}
}


export class CartService {
	getCart = getCart
	createIfNotExists = createIfNotExists
	addPromocode = addPromocode
	deletePromocode = deletePromocode
	addCartItem = addCartItem
	updateCartItem = updateCartItem
	deleteCartItem = deleteCartItem
	clearCart = clearCart


	constructor(readonly fastify: FastifyInstance) {
		this.calculateCartInfo = this.calculateCartInfo.bind(this)
		this.getUserCart = this.getUserCart.bind(this)
	}


	async getUserCart<
		T extends | {
			log: FastifyBaseLogger;
			logMsg: string;
			clientMsg?: string;
		}
			| undefined = undefined,
	>(
		userId: User["id"],
		options?: T,
	): Promise<T extends undefined ? Cart | undefined : Cart> {
		const row = await this.fastify.kysely
			.selectFrom("cart")
			.selectAll()
			.where("userId", "=", userId)
			.executeTakeFirst();

		if (options) {
			if (!row) {
				options.log.info({userId}, options.logMsg);
				throw this.fastify.httpErrors.notFound(options.clientMsg ?? "Cart not found");
			}

			return row as T extends undefined ? Cart | undefined : Cart;
		}

		return row as T extends undefined ? Cart | undefined : Cart;
	}

	async calculateCartInfo<T extends "full" | "count" = "full">(
		userId: User["id"],
		options?: {
			currencyFrom: Currency;
			currencyTo: Currency;
		},
		type: T = "full" as T,
	): Promise<
		T extends "full" ? { count: number; totalPrice: number } : { count: number }
	> {

		if (type === "count") {
			const [res] = await this.fastify.kysely
				.selectFrom("cartItem")
				.innerJoin("cart", "cart.id", "cartItem.cartId")
				.innerJoin("productSku", "productSku.id", "cartItem.productSkuId")
				.innerJoin("product", "product.id", "productSku.productId")
				.select((eb) => eb.fn.countAll().as("count"))
				.where("cart.userId", "=", userId)
				.where("product.isDeleted", "=", false)
				.execute();

			return {count: Number(res.count)} as T extends "full"
				? { count: number; totalPrice: number }
				: { count: number };
		}

		const items = await this.fastify.kysely
			.selectFrom("cartItem")
			.innerJoin("cart", "cart.id", "cartItem.cartId")
			.innerJoin("productSku", "productSku.id", "cartItem.productSkuId")
			.innerJoin("product", "product.id", "productSku.productId")
			.select([
				"productSku.price",
				"productSku.salePrice",
				"productSku.quantity as stock",
				"cartItem.quantity",
			])
			.where("cart.userId", "=", userId)
			.where("product.isDeleted", "=", false)
			.execute();


		console.log(items)

		const totalPrice = items.reduce((acc, item) => {
			const price = item.salePrice ?? item.price;
			const qty = Math.min(item.quantity, item.stock);
			const priceConverted = options
				? this.fastify.priceService.convertCurrency(price, options.currencyFrom, options.currencyTo)
				: price;
			return acc + priceConverted * qty;
		}, 0);

		return {
			count: items.length,
			totalPrice,
		} as T extends "full"
			? { count: number; totalPrice: number }
			: { count: number };
	}

}


export default fp(async (fastify: FastifyInstance) => {
	fastify.decorate("cartService", new CartService(fastify))
}, {
	name: "cartService",
	dependencies: ["productSkuService", "promocodeService", "priceService"]
})