import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { Transaction } from "kysely";
import { MaxCartItemCount } from "../const/const.js";
import { ForeignKeyConstraintCode } from "../const/database.js";
import type { AddCartItemRequest } from "../schemas/cart/add-cart-item.schema.js";
import type { AddCartPromocodeRequest } from "../schemas/cart/add-cart-promocode.schema.js";
import type { CartItemParam } from "../schemas/cart/cart-item-param.schema.js";
import type { GetCartRequestQuery } from "../schemas/cart/get-cart.schema.js";
import type { UpdateCartItemRequest } from "../schemas/cart/update-cart-item.schema.js";
import type { Combined, Nullable } from "../types/base.js";
import type { Cart, CartItem } from "../types/db/cart.js";
import {
	Currency,
	type DB,
	OrderStatus,
	PromocodeType,
} from "../types/db/db.js";
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
		priceService: {
			applyPromocode,
			convertCurrency,
			transformPrice,
			getExchangeRates,
		},
	} = instance;

	async function getCart(
		userId: User["id"],
		query: GetCartRequestQuery,
		log: FastifyBaseLogger,
	): Promise<{
		totalPrice: number;
		currency: Currency;
		promocode: Nullable<
			Pick<Promocode, "id" | "code" | "type" | "discountValue" | "validTo">
		>;
		cartItems: Combined<
			Pick<CartItem, "id" | "quantity"> &
				Pick<ProductSku, "sku" | "price" | "salePrice"> & {
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

		const hasPromocode = promocode && promocodeService.isValid(promocode).valid;

		if (query.currencyTo) {
			const exchangeRates = await getExchangeRates(log);

			if (!exchangeRates) {
				throw httpErrors.serviceUnavailable(
					"Currency conversion temporarily unavailable",
				);
			}
		}

		const { totalPrice } = await calculateCartInfo(
			userId,
			query.currencyTo
				? { currencyFrom: Currency.Rub, currencyTo: query.currencyTo }
				: undefined,
		);

		if (
			query.currencyTo &&
			hasPromocode &&
			promocode!.type === PromocodeType.Fixed
		) {
			promocode!.discountValue = convertCurrency(
				Number(promocode!.discountValue),
				Currency.Rub,
				query.currencyTo,
			).toString();
		}

		const withPromocodePrice = hasPromocode
			? applyPromocode(totalPrice, promocode!)
			: totalPrice;

		return {
			totalPrice: transformPrice(withPromocodePrice, Currency.Rub, "read"),
			currency: query.currencyTo ? query.currencyTo : Currency.Rub,
			promocode: hasPromocode
				? {
						id: promocode!.id,
						code: promocode!.code,
						type: promocode!.type,
						discountValue:
							promocode!.type === PromocodeType.Fixed
								? transformPrice(
										Number(promocode!.discountValue),
										query.currencyTo ? query.currencyTo : Currency.Rub,
										"read",
									).toString()
								: promocode!.discountValue,
						validTo: promocode!.validTo,
					}
				: null,
			cartItems: products.map((p) => {
				const convertedPrice = query.currencyTo
					? convertCurrency(p.price, Currency.Rub, query.currencyTo)
					: p.price;
				const convertedSalePrice =
					p.salePrice && query.currencyTo
						? convertCurrency(p.salePrice, Currency.Rub, query.currencyTo)
						: p.salePrice;

				return {
					id: p.cartItemId,
					productSkuId: p.id,
					quantity: p.cartItemQuantity,
					productSkuQuantity: p.quantity,
					price: transformPrice(
						convertedPrice,
						query.currencyTo ? query.currencyTo : Currency.Rub,
						"read",
					),
					salePrice: convertedSalePrice
						? transformPrice(
								convertedSalePrice,
								query.currencyTo ? query.currencyTo : Currency.Rub,
								"read",
							)
						: null,
					images: p.images ?? [],
					sku: p.sku,
					product: {
						name: p.name,
						shortDescription: p.shortDescription,
					},
				};
			}),
		};
	}

	async function addPromocode(
		userId: User["id"],
		data: AddCartPromocodeRequest,
		log: FastifyBaseLogger,
	): Promise<Pick<Promocode, "code" | "type" | "discountValue" | "validTo">> {
		const cart = await getUserCart(userId, {
			log,
			logMsg: "Add cart promocode failed: cart not found",
		});

		const promocode = await promocodeService.get(
			{
				type: "code",
				code: data.promocode,
			},
			{
				validate: true,
				onError: (msg) => log.info(`Add cart promocode failed: ${msg}`),
			},
		);

		const isValid = promocodeService.isValid(promocode);

		if (!isValid.valid) {
			log.info(
				{ promocodeId: promocode.id },
				`Add cart promocode failed: ${isValid.reason}`,
			);
			throw httpErrors.badRequest("Promocode is not valid");
		}

		const isUsed = await kysely
			.selectFrom("order")
			.where((eb) =>
				eb.and([
					eb("status", "!=", OrderStatus.Cancelled),
					eb("promocodeId", "=", promocode.id),
					eb("userId", "=", userId),
				]),
			)
			.executeTakeFirst();

		if (isUsed) {
			log.info(
				{ promocodeId: promocode.id, userId },
				"Add cart promocode failed: promocode already used in a previous order",
			);
			throw httpErrors.badRequest(
				"This promocode has already been used in a previous order",
			);
		}

		await kysely
			.updateTable("cart")
			.set({ promocodeId: promocode.id })
			.where("id", "=", cart.id)
			.execute();

		return {
			code: promocode.code,
			type: promocode.type,
			discountValue: promocode.discountValue,
			validTo: promocode.validTo,
		};
	}

	async function deletePromocode(
		userId: User["id"],
		log: FastifyBaseLogger,
		trx?: Transaction<DB>,
	) {
		const cart = await getUserCart(userId, {
			log,
			logMsg: "Delete cart promocode failed: cart not found",
		});

		if (!cart.promocodeId) {
			log.info(
				{ userId },
				"Delete cart promocode failed: cart doesn't have a promocode",
			);
			throw httpErrors.badRequest("Cart doesn't have a promocode");
		}

		await (trx ?? kysely)
			.updateTable("cart")
			.set({ promocodeId: null })
			.where("id", "=", cart.id)
			.execute();
	}

	async function addCartItem(
		userId: User["id"],
		data: AddCartItemRequest,
		log: FastifyBaseLogger,
	) {
		try {
			const cart = await getUserCart(userId, {
				log,
				logMsg: "Add cart item failed: cart not found",
			});

			if (!cart) {
				log.info({ userId }, "Add cart item failed: cart not found");
				throw httpErrors.notFound("Cart not found");
			}

			const { count } = await calculateCartInfo<"count">(userId);
			if (count >= MaxCartItemCount) {
				log.info({ userId }, "Add cart item failed: сart item limit exceeded");
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
				{ cartItemId: param.cartItemId },
				"Delete cart item failed: cart item not found",
			);
			throw httpErrors.notFound("Cart item not found");
		}
	}

	async function clearCart(userId: User["id"], log: FastifyBaseLogger) {
		const cart = await getUserCart(userId, {
			log,
			logMsg: "Clear cart failed: cart not found",
		});

		if (!cart) {
			log.info({ userId }, "Clear cart failed: cart not found");
			throw httpErrors.notFound("Cart not found");
		}

		await kysely
			.deleteFrom("cartItem")
			.where("cartId", "=", cart.id)
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

	async function getUserCart<
		T extends
			| {
					log: FastifyBaseLogger;
					logMsg: string;
					clientMsg?: string;
			  }
			| undefined = undefined,
	>(
		userId: User["id"],
		options?: T,
	): Promise<T extends undefined ? Cart | undefined : Cart> {
		const row = await kysely
			.selectFrom("cart")
			.selectAll()
			.where("userId", "=", userId)
			.executeTakeFirst();

		if (options) {
			if (!row) {
				options.log.info({ userId }, options.logMsg);
				throw httpErrors.notFound(options.clientMsg ?? "Cart not found");
			}

			return row as T extends undefined ? Cart | undefined : Cart;
		}

		return row as T extends undefined ? Cart | undefined : Cart;
	}

	async function calculateCartInfo<T extends "full" | "count" = "full">(
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
			const [res] = await kysely
				.selectFrom("cartItem")
				.select((eb) => eb.fn.countAll().as("count"))
				.innerJoin("cart", "cart.id", "cartItem.cartId")
				.where("cart.userId", "=", userId)
				.execute();

			return { count: Number(res.count) } as T extends "full"
				? { count: number; totalPrice: number }
				: { count: number };
		}

		const items = await kysely
			.selectFrom("cartItem")
			.innerJoin("cart", "cart.id", "cartItem.cartId")
			.innerJoin("productSku", "productSku.id", "cartItem.productSkuId")
			.select([
				"productSku.price",
				"productSku.salePrice",
				"productSku.quantity as stock",
				"cartItem.quantity",
			])
			.where("cart.userId", "=", userId)
			.execute();

		const totalPrice = items.reduce((acc, item) => {
			const price = item.salePrice ?? item.price;
			const qty = Math.min(item.quantity, item.stock);
			const priceConverted = options
				? convertCurrency(price, options.currencyFrom, options.currencyTo)
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

	return {
		getCart,
		addPromocode,
		deletePromocode,
		addCartItem,
		updateCartItem,
		deleteCartItem,
		clearCart,
		createIfNotExists,
	};
}
