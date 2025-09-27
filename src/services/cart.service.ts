import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { Transaction } from "kysely";
import { MaxCartItemCount } from "../const/const.js";
import { ForeignKeyConstraintCode } from "../const/database.js";
import type { AddCartItemRequest } from "../schemas/cart/add-cart-item.schema.js";
import type { AddCartPromocodeRequest } from "../schemas/cart/add-cart-promocode.schema.js";
import type { CartItemParam } from "../schemas/cart/cart-item-param.schema.js";
import type { UpdateCartItemRequest } from "../schemas/cart/update-cart-item.schema.js";
import type { Combined, Nullable } from "../types/base.js";
import type { CartItem } from "../types/db/cart.js";
import { Currency, type DB } from "../types/db/db.js";
import { isDatabaseError } from "../types/db/error.js";
import type {
	Product,
	ProductSku,
	ProductSkuImages,
} from "../types/db/product.js";
import type { Promocode } from "../types/db/promocode.js";
import type { User } from "../types/db/user.js";

export function createCartService(instance: FastifyInstance) {
	const {
		kysely,
		httpErrors,
		productSkuService,
		promocodeService,
		priceService: { applyPromocode, convertCurrency, transformPrice },
	} = instance;

	async function getCart(userId: User["id"]): Promise<{
		totalPrice: number;
		promocode: Nullable<
			Pick<Promocode, "code" | "type" | "discountValue" | "validTo">
		>;
		cartItems: Combined<
			Pick<CartItem, "id" | "quantity"> &
				Pick<ProductSku, "sku" | "currency" | "price" | "salePrice"> & {
					images: Pick<ProductSkuImages, "id" | "imageId" | "imageUrl">[];
					productSkuId: ProductSku["id"];
					productSkuQuantity: ProductSku["quantity"];
				},
			Pick<Product, "name" | "shortDescription">,
			"product"
		>[];
	}> {
		const products = await productSkuService
			.buildAdminProductSku()
			.innerJoin("cartItem", "cartItem.productSkuId", "productSku.id")
			.innerJoin("cart", "cart.id", "cartItem.cartId")
			.leftJoin("promocode", "promocode.id", "cart.promocodeId")
			.select([
				"cartItem.id as cartItemId",
				"cartItem.quantity as cartItemQuantity",
				"cart.promocodeId",
			])
			.where("cart.userId", "=", userId)
			.orderBy("cartItem.createdAt", "desc")
			.execute();

		let promocode: Nullable<Promocode> = null;

		if (products.length > 0 && products[0].promocodeId) {
			promocode =
				(await promocodeService.get({
					type: "id",
					id: products[0].promocodeId,
				})) ?? null;
		}

		const { totalPrice } = await calculateCartInfo(userId);

		return {
			totalPrice: promocode
				? applyPromocode(totalPrice, promocode)
				: totalPrice,
			promocode: promocode
				? {
						code: promocode.code,
						type: promocode.type,
						discountValue: promocode.discountValue,
						validTo: promocode.validTo,
					}
				: null,
			cartItems: products.map((p) => ({
				id: p.cartItemId,
				productSkuId: p.id,
				quantity: p.cartItemQuantity,
				productSkuQuantity: p.quantity,
				currency: p.currency,
				price: transformPrice(p.price, p.currency, "read"),
				salePrice: p.salePrice
					? transformPrice(p.salePrice, p.currency, "read")
					: null,
				images: p.images ?? [],
				sku: p.sku,
				product: {
					name: p.name,
					shortDescription: p.shortDescription,
				},
			})),
		};
	}

	async function addPromocode(
		userId: User["id"],
		data: AddCartPromocodeRequest,
		log: FastifyBaseLogger,
	): Promise<Pick<Promocode, "code" | "type" | "discountValue" | "validTo">> {
		const cartId = await getUserCartId(userId);

		if (!cartId) {
			log.info({ userId }, "Add cart promocode failed: cart not found");
			throw httpErrors.notFound("Cart not found");
		}

		const { id, code, type, discountValue, validTo } =
			await promocodeService.get(
				{
					type: "code",
					code: data.promocode,
				},
				{
					validate: true,
					onError: (msg) => log.info(`Add cart promocode failed: ${msg}`),
				},
			);

		await kysely
			.updateTable("cart")
			.set({ promocodeId: id })
			.where("id", "=", cartId)
			.execute();

		return { code, type, discountValue, validTo };
	}

	async function addCartItem(
		userId: User["id"],
		data: AddCartItemRequest,
		log: FastifyBaseLogger,
	) {
		try {
			const cartId = await getUserCartId(userId);

			if (!cartId) {
				log.info({ userId }, "Add cart item failed: cart not found");
				throw httpErrors.notFound("Cart not found");
			}

			const cartInfo = await calculateCartInfo(userId);
			if (cartInfo.count >= MaxCartItemCount) {
				log.info({ userId }, "Add cart item failed: сart item limit exceeded");
				throw httpErrors.badRequest("Cart item limit exceeded");
			}

			await kysely
				.insertInto("cartItem")
				.values({
					cartId,
					quantity: data.quantity,
					productSkuId: data.productSkuId,
				})
				.onConflict((oc) =>
					oc
						.columns(["cartId", "productSkuId"])
						.doUpdateSet({ quantity: data.quantity }),
				)
				.execute();
		} catch (err) {
			if (
				isDatabaseError(err) &&
				err.code === ForeignKeyConstraintCode &&
				err.detail.includes("product_sku_id")
			) {
				log.info(
					{ productSkuId: data.productSkuId },
					"Add cart item failed: product sku not found",
				);
				throw httpErrors.notFound("Product sku not found");
			}

			throw err;
		}
	}

	async function updateCartItem(
		userId: User["id"],
		data: UpdateCartItemRequest,
		param: CartItemParam,
		log: FastifyBaseLogger,
	) {
		const cartId = await getUserCartId(userId);

		if (!cartId) {
			log.info({ userId }, "Update cart item failed: cart not found");
			throw httpErrors.notFound("Cart not found");
		}

		const row = await kysely
			.updateTable("cartItem")
			.where("cartId", "=", cartId)
			.where("cartItem.id", "=", param.cartItemId)
			.set({
				quantity: data.quantity,
			})
			.returning("id")
			.executeTakeFirst();

		if (!row) {
			log.info(
				{ cartItemId: param.cartItemId },
				"Update cart item failed: cart item not found",
			);
			throw httpErrors.notFound("Cart item not found");
		}
	}

	async function deleteCartItem(
		userId: User["id"],
		param: CartItemParam,
		log: FastifyBaseLogger,
	) {
		const cartId = await getUserCartId(userId);

		if (!cartId) {
			log.info({ userId }, "Delete cart item failed: cart not found");
			throw httpErrors.notFound("Cart not found");
		}

		const row = await kysely
			.deleteFrom("cartItem")
			.where("cartId", "=", cartId)
			.where("cartItem.id", "=", param.cartItemId)
			.returning("id")
			.executeTakeFirst();

		if (!row) {
			log.info(
				{ cartItemId: param.cartItemId },
				"Delete cart item failed: cart item not found",
			);
			throw httpErrors.notFound("Cart item not found");
		}
	}

	async function clearCart(userId: User["id"], log: FastifyBaseLogger) {
		const cartId = await getUserCartId(userId);

		if (!cartId) {
			log.info({ userId }, "Delete cart item failed: cart not found");
			throw httpErrors.notFound("Cart not found");
		}

		await kysely
			.deleteFrom("cartItem")
			.where("cartId", "=", cartId)
			.returning("id")
			.executeTakeFirst();
	}

	async function createIfNotExists(
		user: Pick<User, "id">,
		trx?: Transaction<DB>,
		shouldThrow?: boolean,
	) {
		const result = await (trx ?? kysely)
			.insertInto("cart")
			.values({ userId: user.id })
			.onConflict((oc) => oc.column("userId").doNothing())
			.executeTakeFirst();

		if (shouldThrow && !result.numInsertedOrUpdatedRows) {
			throw new Error("Cart already exists for this user");
		}
	}

	async function getUserCartId(userId: User["id"]) {
		const row = await kysely
			.selectFrom("cart")
			.select("id")
			.where("userId", "=", userId)
			.executeTakeFirst();

		return row?.id || undefined;
	}

	async function calculateCartInfo(
		userId: User["id"],
		currency: Currency = Currency.Rub,
	) {
		const items = await kysely
			.selectFrom("cartItem")
			.innerJoin("cart", "cart.id", "cartItem.cartId")
			.innerJoin("productSku", "productSku.id", "cartItem.productSkuId")
			.select([
				"productSku.price",
				"productSku.salePrice",
				"productSku.currency",
				"productSku.quantity as stock",
				"cartItem.quantity",
			])
			.where("cart.userId", "=", userId)
			.execute();

		const totalPrice = items.reduce((acc, item) => {
			const price = item.salePrice ?? item.price;
			const qty = Math.min(item.quantity, item.stock);
			const priceConverted = convertCurrency(price, item.currency, currency);
			return acc + priceConverted * qty;
		}, 0);

		return {
			count: items.length,
			totalPrice: transformPrice(totalPrice, currency, "read"),
		};
	}

	return {
		getCart,
		addPromocode,
		addCartItem,
		updateCartItem,
		deleteCartItem,
		clearCart,
		createIfNotExists,
	};
}
