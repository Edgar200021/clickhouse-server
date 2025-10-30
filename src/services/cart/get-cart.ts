import {User} from "@/types/db/user.js";
import {GetCartRequestQuery} from "@/schemas/cart/get-cart.schema.js";
import {FastifyBaseLogger} from "fastify";
import {Combined, Nullable} from "@/types/base.js";
import {Promocode} from "@/types/db/promocode.js";
import {CartItem} from "@/types/db/cart.js";
import {Product, ProductSku, ProductSkuImages} from "@/types/db/product.js";
import {type CartService} from "@/services/cart/cart.service.js";
import {Currency, PromocodeType} from "@/types/db/db.js";

export async function getCart(
	this: CartService,
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
	const {
		fastify: {productSkuService, promocodeService, priceService, httpErrors},
		calculateCartInfo
	} = this


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
		.where("product.isDeleted", "=", false)
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
		const exchangeRates = await priceService.getExchangeRates(log);

		if (!exchangeRates) {
			throw httpErrors.serviceUnavailable(
				"Currency conversion temporarily unavailable",
			);
		}
	}

	const {totalPrice} = await calculateCartInfo(
		userId,
		query.currencyTo
			? {currencyFrom: Currency.Rub, currencyTo: query.currencyTo}
			: undefined,
	);

	if (
		query.currencyTo &&
		hasPromocode &&
		promocode!.type === PromocodeType.Fixed
	) {
		promocode!.discountValue = priceService.convertCurrency(
			Number(promocode!.discountValue),
			Currency.Rub,
			query.currencyTo,
		).toString();
	}

	const withPromocodePrice = hasPromocode
		? priceService.applyPromocode(totalPrice, promocode!)
		: totalPrice;

	return {
		totalPrice: priceService.transformPrice(withPromocodePrice, Currency.Rub, "read"),
		currency: query.currencyTo ? query.currencyTo : Currency.Rub,
		promocode: hasPromocode
			? {
				id: promocode!.id,
				code: promocode!.code,
				type: promocode!.type,
				discountValue:
					promocode!.type === PromocodeType.Fixed
						? priceService.transformPrice(
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
				? priceService.convertCurrency(p.price, Currency.Rub, query.currencyTo)
				: p.price;
			const convertedSalePrice =
				p.salePrice && query.currencyTo
					? priceService.convertCurrency(p.salePrice, Currency.Rub, query.currencyTo)
					: p.salePrice;

			return {
				id: p.cartItemId,
				productSkuId: p.id,
				quantity: p.cartItemQuantity,
				productSkuQuantity: p.quantity,
				price: priceService.transformPrice(
					convertedPrice,
					query.currencyTo ? query.currencyTo : Currency.Rub,
					"read",
				),
				salePrice: convertedSalePrice
					? priceService.transformPrice(
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