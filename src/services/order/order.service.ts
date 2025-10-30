import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import {
	type Expression,
	type ExpressionBuilder,
	type SqlBool,
	sql,
} from "kysely";
import type { GetOrdersRequestQuery } from "@/schemas/order/get-orders.schema.js";
import type { GetOrdersAdminRequestQuery } from "@/schemas/order/get-orders-admin.schema.js";
import type { OrderParam } from "@/schemas/order/order-param.schema.js";
import { cancelExpiredOrders } from "@/services/order/cancel-expired-orders.js";
import { create } from "@/services/order/create.js";
import { getAll } from "@/services/order/get-all.js";
import { getAllByUserId } from "@/services/order/get-all-by-user-id.js";
import { getOne } from "@/services/order/get-one.js";
import { getOneByUserId } from "@/services/order/get-one-by-user-id.js";
import type { Combined, Nullable, WithPageCount } from "@/types/base.js";
import { type DB, PromocodeType, UserRole } from "@/types/db/db.js";
import type { Order, OrderItem } from "@/types/db/order.js";
import type {
	Product,
	ProductSku,
	ProductSkuImages,
} from "@/types/db/product.js";
import type { Promocode } from "@/types/db/promocode.js";
import type { User } from "@/types/db/user.js";

declare module "fastify" {
	export interface FastifyInstance {
		orderService: OrderService;
	}
}

export type GetAllResult<T extends UserRole> = T extends UserRole.Admin
	? Combined<
			Order,
			Pick<Promocode, "code" | "discountValue" | "type">,
			"promocode",
			true
		> & {
			preview: {
				imageUrL: string;
				orderItemCount: number;
			};
		}
	: Combined<
			Omit<Order, "id" | "updatedAt" | "userId">,
			Pick<Promocode, "id" | "code" | "discountValue" | "type">,
			"promocode",
			true
		> & {
			preview: {
				imageUrL: string;
				orderItemCount: number;
			};
		};

export type GetOneResult<T extends UserRole> = T extends UserRole.Admin
	? Combined<
			Omit<Order, "id" | "promocodeId" | "updatedAt" | "userId">,
			{
				productSkuId: ProductSku["id"];
				name: Product["name"];
				image: ProductSkuImages["imageUrl"];
				price: OrderItem["price"];
				quantity: OrderItem["quantity"];
			}[],
			"orderItems"
		> & {
			promocode: Nullable<Pick<Promocode, "code" | "discountValue" | "type">>;
		}
	: Combined<
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

export type GetAllQuery<T extends UserRole> = T extends UserRole.Admin
	? GetOrdersAdminRequestQuery
	: GetOrdersRequestQuery;

export class OrderService {
	getAll = getAll;
	getAllByUserId = getAllByUserId;
	getOne = getOne;
	getOneByUserId = getOneByUserId;
	create = create;
	cancelExpiredOrders = cancelExpiredOrders;

	constructor(readonly fastify: FastifyInstance) {
		this.getOrder = this.getOrder.bind(this);
		this.getOrders = this.getOrders.bind(this);
		this.buildFilters = this.buildFilters.bind(this);
		this.isOrderExpired = this.isOrderExpired.bind(this);
	}

	async getOrder<T extends UserRole>(
		param: OrderParam,
		role: T,
		userId: T extends UserRole.Regular ? User["id"] : undefined,
		log: FastifyBaseLogger,
	): Promise<GetOneResult<T>> {
		const { kysely, httpErrors, priceService, productSkuService, config } =
			this.fastify;

		const order = await kysely
			.selectFrom("order")
			.innerJoin("users", "users.id", "order.userId")
			.leftJoin("promocode", "promocode.id", "order.promocodeId")
			.selectAll(["order"])
			.select(["promocode.code", "promocode.discountValue", "promocode.type"])
			.where("order.number", "=", param.orderNumber)
			.$if(typeof userId === "string", (eb) =>
				eb.where("users.id", "=", userId!),
			)
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
					...(role === UserRole.Admin && { productSkuId: productSku.id }),
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
			...(role === UserRole.Regular && {
				paymentTimeoutInMinutes: config.application.orderPaymentTTLMinutes,
			}),
		} as unknown as Promise<GetOneResult<T>>;
	}

	async getOrders<T extends UserRole>(
		query: GetAllQuery<T>,
		role: T,
		userId: T extends UserRole.Regular ? User["id"] : undefined,
	): Promise<WithPageCount<GetAllResult<T>[], "orders">> {
		const { kysely, httpErrors, priceService, productSkuService, config } =
			this.fastify;

		const orders = await kysely
			.selectFrom("order")
			.innerJoin("users", "users.id", "order.userId")
			.leftJoin("promocode", "promocode.id", "order.promocodeId")
			.selectAll(["order"])
			.select(["promocode.code", "promocode.discountValue", "promocode.type"])
			.$if(typeof userId === "string", (eb) =>
				eb.where("users.id", "=", userId!),
			)
			.where((eb) => this.buildFilters(query, eb, role))
			.orderBy("createdAt", "desc")
			.limit(query.limit)
			.offset(query.limit * (query.page - 1))
			.execute();

		if (!orders.length) return { orders: [], pageCount: 0 };

		const results: GetAllResult<T>[] = await Promise.all(
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

				const orderItem: GetAllResult<UserRole.Regular> = {
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
								...(role === UserRole.Admin && { id: order.promocodeId! }),
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
			.$if(typeof userId === "string", (eb) =>
				eb.where("order.userId", "=", userId!),
			)
			.where((eb) => this.buildFilters(query, eb, role))
			.executeTakeFirstOrThrow();

		return {
			pageCount: Math.ceil(Number(count) / query.limit),
			orders: results.sort(
				(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
			),
		};
	}

	buildFilters<T extends UserRole>(
		query: GetAllQuery<T>,
		eb: ExpressionBuilder<DB, "order">,
		role: T,
	) {
		const ands: Expression<SqlBool>[] = [];

		if (role === UserRole.Admin && "search" in query && query.search) {
			ands.push(
				eb.or([
					eb(
						sql`"order"
          .
          number
          ::text`,
						"like",
						`%${query.search}%`,
					),
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

	isOrderExpired(orderCreatedAt: Date) {
		return (
			Date.now() >
			new Date(orderCreatedAt).getTime() +
				this.fastify.config.application.orderPaymentTTLMinutes * 60000
		);
	}
}

export default fp(
	async (fastify: FastifyInstance) => {
		fastify.decorate("orderService", new OrderService(fastify));
	},
	{
		name: "orderService",
		dependencies: ["cartService", "priceService", "productSkuService"],
	},
);
