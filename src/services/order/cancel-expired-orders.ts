import { sql } from "kysely";
import type { OrderService } from "@/services/order/order.service.js";
import { OrderStatus } from "@/types/db/db.js";

export async function cancelExpiredOrders(this: OrderService) {
	const { kysely, config } = this.fastify;

	await kysely.transaction().execute(async (trx) => {
		const expiredOrders = await trx
			.updateTable("order")
			.set({ status: OrderStatus.Cancelled })
			.where("status", "=", OrderStatus.Pending)
			.where(
				"createdAt",
				"<",
				sql<Date>`${sql`NOW
        () -
        ${config.application.orderPaymentTTLMinutes}
        *
        INTERVAL
        '1 minute'`}`,
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
