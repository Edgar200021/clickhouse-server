import type { FastifyBaseLogger } from "fastify";
import type { CreateOrderRequest } from "@/schemas/order/create-order.schema.js";
import type { OrderService } from "@/services/order/order.service.js";
import { OrderStatus } from "@/types/db/db.js";
import { isDatabaseError } from "@/types/db/error.js";
import type { User } from "@/types/db/user.js";

export async function create(
	this: OrderService,
	userId: User["id"],
	data: CreateOrderRequest,
	log: FastifyBaseLogger,
) {
	const { kysely, config, httpErrors, cartService, priceService } =
		this.fastify;

	const { count } = await kysely
		.selectFrom("order")
		.select((eb) => eb.fn.countAll().as("count"))
		.where("userId", "=", userId)
		.where("status", "=", OrderStatus.Pending)
		.executeTakeFirstOrThrow();

	if (Number(count) >= config.application.maxPendingOrdersPerUser) {
		log.info(
			{ userId },
			"Create order failed: max pending orders limit reached",
		);
		throw httpErrors.badRequest(
			`You have reached the maximum number of pending orders (${config.application.maxPendingOrdersPerUser}). Please complete or cancel existing orders before creating new ones.`,
		);
	}

	const number = await kysely.transaction().execute(async (trx) => {
		try {
			const { totalPrice, promocode, cartItems } = await cartService.getCart(
				userId,
				{ currencyTo: data.currency },
				log,
			);

			const availableItems = cartItems.filter(
				(item) => item.productSkuQuantity > 0,
			);

			if (!availableItems.length) {
				log.info({ userId }, "Create order failed: no available items in cart");
				throw httpErrors.badRequest(
					"Your cart is empty or all items are out of stock",
				);
			}

			const { id: orderId, number } = await trx
				.insertInto("order")
				.values({
					name: data.name,
					phoneNumber: data.phoneNumber,
					email: data.email,
					currency: data.currency,
					billingAddressCity: data.billingAddress.city,
					billingAddressStreet: data.billingAddress.street,
					billingAddressHome: data.billingAddress.home,
					billingAddressApartment: data.billingAddress.apartment,
					deliveryAddressCity: data.deliveryAddress.city,
					deliveryAddressStreet: data.deliveryAddress.street,
					deliveryAddressHome: data.deliveryAddress.home,
					deliveryAddressApartment: data.deliveryAddress.apartment,
					userId,
					total: priceService.transformPrice(
						totalPrice,
						data.currency,
						"store",
					),
					...(promocode?.id ? { promocodeId: promocode.id } : {}),
				})
				.returning(["id", "number"])
				.executeTakeFirstOrThrow();

			if (promocode) {
				await cartService.deletePromocode(userId, log, trx);
			}

			await trx
				.insertInto("orderItem")
				.values(
					availableItems.map((item) => ({
						orderId,
						productSkuId: item.productSkuId,
						price: item.salePrice || item.price,
						quantity:
							item.quantity < item.productSkuQuantity
								? item.quantity
								: item.productSkuQuantity,
					})),
				)
				.executeTakeFirstOrThrow();

			await Promise.all([
				...availableItems.map((item) =>
					trx
						.updateTable("productSku")
						.set((eb) => {
							return {
								quantity:
									item.quantity >= item.productSkuQuantity
										? 0
										: eb("quantity", "-", eb.val(item.quantity)),
							};
						})
						.where("id", "=", item.productSkuId)
						.execute(),
				),
				...(promocode
					? [
							trx
								.updateTable("promocode")
								.set((eb) => ({
									usageCount: eb("usageCount", "+", eb.val(1)),
								}))
								.where("id", "=", promocode.id)
								.execute(),
						]
					: []),
			]);

			return number;
		} catch (error) {
			if (
				isDatabaseError(error) &&
				error.table === "product_sku" &&
				error.constraint &&
				error.constraint === "product_sku_quantity_positive"
			) {
				log.info("Create order failed: not enougse stock available");
				throw httpErrors.badRequest("Not enough stock available");
			}
			throw error;
		}
	});

	return number;
}
