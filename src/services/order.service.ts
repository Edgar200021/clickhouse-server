import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import {
	type Expression,
	type ExpressionBuilder,
	type SqlBool,
	sql,
} from "kysely";
import type { CreateOrderRequest } from "../schemas/order/create-order.schema.js";
import type { GetOrdersRequestQuery } from "../schemas/order/get-orders.schema.js";
import type { GetOrdersAdminRequestQuery } from "../schemas/order/get-orders-admin.schema.js";
import type { OrderParam } from "../schemas/order/order-param.schema.js";
import type { Combined, Nullable, WithPageCount } from "../types/base.js";
import {
	type DB,
	OrderStatus,
	PromocodeType,
	UserRole,
} from "../types/db/db.js";
import { isDatabaseError } from "../types/db/error.js";
import type { Order, OrderItem } from "../types/db/order.js";
import type { Product, ProductSkuImages } from "../types/db/product.js";
import type { Promocode } from "../types/db/promocode.js";
import type { User } from "../types/db/user.js";

type GetAllResult = Combined<
	Omit<Order, "id" | "promocodeId" | "updatedAt" | "userId">,
	Pick<Promocode, "code" | "discountValue" | "type">,
	"promocode",
	true
> & {
	preview: {
		imageUrL: string;
		orderItemCount: number;
	};
};

type GetOneResult = Combined<
	Omit<Order, "id" | "promocodeId" | "updatedAt" | "userId">,
	{
		name: Product["name"];
		image: ProductSkuImages["imageUrl"];
		price: OrderItem["price"];
		quantity: OrderItem["quantity"];
	}[],
	"orderItems"
> & {
	promocode: Nullable<Pick<Promocode, "code" | "discountValue" | "type">>;
	paymentTimeoutInMinutes: number;
};

type GetAllQuery<T extends UserRole> = T extends UserRole.Admin
	? GetOrdersAdminRequestQuery
	: GetOrdersRequestQuery;

export function createOrderService(instance: FastifyInstance) {
	const {
		kysely,
		httpErrors,
		cartService,
		priceService,
		productSkuService,
		config,
	} = instance;

	async function getAll(query: GetOrdersRequestQuery) {
		const orders = await kysely
			.selectFrom("order")
			.innerJoin("users", "users.id", "order.userId")
			.selectAll(["order"])
			.select(["userId as userId", "users.email as userEmail"])
			.where((eb) => buildFilters(query, eb, UserRole.Admin))
			.orderBy("createdAt", "desc")
			.limit(query.limit)
			.offset(query.limit * (query.page - 1))
			.execute();

		return orders;
	}

	async function getAllByUserId(
		userId: User["id"],
		query: GetOrdersRequestQuery,
	): Promise<WithPageCount<GetAllResult[], "orders">> {
		const orders = await kysely
			.selectFrom("order")
			.innerJoin("users", "users.id", "order.userId")
			.leftJoin("promocode", "promocode.id", "order.promocodeId")
			.selectAll(["order"])
			.select(["promocode.code", "promocode.discountValue", "promocode.type"])
			.where("users.id", "=", userId)
			.where((eb) => buildFilters(query, eb, UserRole.Regular))
			.orderBy("createdAt", "desc")
			.limit(query.limit)
			.offset(query.limit * (query.page - 1))
			.execute();

		if (!orders.length) return { orders: [], pageCount: 0 };

		const results: GetAllResult[] = await Promise.all(
			orders.map(async (order) => {
				const orderItemCount = await kysely
					.selectFrom("orderItem")
					.select((eb) => eb.fn.countAll().as("count"))
					.where("orderItem.orderId", "=", order.id)
					.executeTakeFirstOrThrow();

				const productSku = await productSkuService
					.buildAdminProductSku()
					.where("productSku.id", "=", (eb) =>
						eb
							.selectFrom("orderItem")
							.select("productSkuId")
							.where("orderId", "=", order.id)
							.orderBy("createdAt", "desc")
							.limit(1),
					)
					.executeTakeFirstOrThrow();

				const orderItem: GetAllResult = {
					...order,
					total: priceService.transformPrice(
						Number(order.total),
						order.currency,
						"read",
					),
					preview: {
						imageUrL: productSku.images?.[0].imageUrl || "",
						orderItemCount: Number(orderItemCount.count),
					},
					promocode: order.discountValue
						? {
								discountValue:
									order.type! === PromocodeType.Percent
										? order.discountValue
										: priceService
												.transformPrice(
													Number(order.discountValue),
													order.currency,
													"read",
												)
												.toString(),
								type: order.type!,
								code: order.code!,
							}
						: null,
				};

				return orderItem;
			}),
		);

		const { count } = await kysely
			.selectFrom("order")
			.select((eb) => eb.fn.countAll().as("count"))
			.where("userId", "=", userId)
			.where((eb) => buildFilters(query, eb, UserRole.Regular))
			.executeTakeFirstOrThrow();

		return {
			pageCount: Math.ceil(Number(count) / query.limit),
			orders: results.sort(
				(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
			),
		};
	}

	async function getOne(param: OrderParam, log: FastifyBaseLogger) {
		const order = await kysely
			.selectFrom("order")
			.innerJoin("users", "users.id", "order.userId")
			.innerJoin("orderItem", "orderItem.orderId", "order.id")
			.selectAll(["order"])
			.select([
				"userId as userId",
				"users.email as userEmail",
				"orderItem.id as orderItemId",
			])
			.where("order.number", "=", param.orderNumber)
			.orderBy("createdAt", "desc")
			.executeTakeFirst();

		if (!order) {
			log.info(
				{ orderNumber: param.orderNumber },
				"Get order failed: order not found",
			);
			throw httpErrors.notFound("Order not found");
		}

		return order;
	}

	async function getOneByUserId(
		userId: User["id"],
		param: OrderParam,
		log: FastifyBaseLogger,
	): Promise<GetOneResult> {
		const order = await kysely
			.selectFrom("order")
			.innerJoin("users", "users.id", "order.userId")
			.leftJoin("promocode", "promocode.id", "order.promocodeId")
			.selectAll(["order"])
			.select(["promocode.code", "promocode.discountValue", "promocode.type"])
			.where("order.number", "=", param.orderNumber)
			.where("users.id", "=", userId)
			.executeTakeFirst();

		if (!order) {
			log.info(
				{ userId, orderNumber: param.orderNumber },
				"Get order by user id failed: order not found",
			);
			throw httpErrors.notFound("Order not found");
		}

		const orderItems = await kysely
			.selectFrom("orderItem")
			.selectAll()
			.where("orderItem.orderId", "=", order.id)
			.orderBy("orderItem.createdAt", "asc")
			.execute();

		const products = await productSkuService
			.buildAdminProductSku()
			.where(
				"productSku.id",
				"in",
				orderItems.map((order) => order.productSkuId),
			)
			.execute();

		const productMap = new Map(products.map((p) => [p.id, p]));

		return {
			...order,
			total: priceService.transformPrice(
				Number(order.total),
				order.currency,
				"read",
			),
			orderItems: orderItems.map((item) => {
				const productSku = productMap.get(item.productSkuId)!;
				return {
					name: productSku.name,
					image: productSku.images?.[0]?.imageUrl || "",
					price: item.price,
					quantity: item.quantity,
				};
			}),
			promocode: order.discountValue
				? {
						discountValue:
							order.type! === PromocodeType.Percent
								? order.discountValue
								: priceService
										.transformPrice(
											Number(order.discountValue),
											order.currency,
											"read",
										)
										.toString(),
						type: order.type!,
						code: order.code!,
					}
				: null,
			paymentTimeoutInMinutes: config.application.orderPaymentTTLMinutes,
		};
	}

	async function create(
		userId: User["id"],
		data: CreateOrderRequest,
		log: FastifyBaseLogger,
	) {
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
					log.info(
						{ userId },
						"Create order failed: no available items in cart",
					);
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

	async function cancelExpiredOrders() {
		await kysely.transaction().execute(async (trx) => {
			const expiredOrders = await trx
				.updateTable("order")
				.set({ status: OrderStatus.Cancelled })
				.where("status", "=", OrderStatus.Pending)
				.where(
					"createdAt",
					"<",
					sql<Date>`${sql`NOW() - ${config.application.orderPaymentTTLMinutes} * INTERVAL '1 minute'`}`,
				)
				.returning(["order.id", "userId", "promocodeId"])
				.execute();

			if (!expiredOrders.length) return;

			await Promise.all(
				expiredOrders
					.filter((item) => item.promocodeId)
					.map(async (item) => {
						await trx
							.updateTable("promocode")
							.set((eb) => ({
								usageCount: eb("usageCount", "-", eb.val(1)),
							}))
							.where("id", "=", item.promocodeId)
							.execute();
					}),
			);

			for (const { id } of expiredOrders) {
				const orderItems = await trx
					.selectFrom("orderItem")
					.select(["quantity", "productSkuId"])
					.where("orderId", "=", id)
					.execute();

				await Promise.all(
					orderItems.map(
						async (item) =>
							await trx
								.updateTable("productSku")
								.set((eb) => ({
									quantity: eb("quantity", "+", eb.val(item.quantity)),
								}))
								.where("id", "=", item.productSkuId)
								.execute(),
					),
				);
			}
		});
	}

	function buildFilters<T extends UserRole>(
		query: GetAllQuery<T>,
		eb: ExpressionBuilder<DB, "order">,
		role: T,
	) {
		const ands: Expression<SqlBool>[] = [];

		if (role === UserRole.Admin && "search" in query && query.search) {
			ands.push(
				eb.or([
					eb("order.number", "=", query.search),
					eb("order.email", "like", `%${query.search}%`),
					eb("order.name", "like", `%${query.search}%`),
				]),
			);
		}

		if (query.status) {
			ands.push(eb("order.status", "=", query.status));
		}

		return eb.and(ands);
	}

	return {
		getAll,
		getAllByUserId,
		getOne,
		getOneByUserId,
		create,
		cancelExpiredOrders,
	};
}
