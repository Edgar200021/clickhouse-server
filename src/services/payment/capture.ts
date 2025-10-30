import type { FastifyBaseLogger } from "fastify";
import type { CapturePaymentRequest } from "@/schemas/payment/capture-payment.schema.js";
import type { PaymentService } from "@/services/payment/payment.service.js";
import { OrderStatus, PaymentStatus } from "@/types/db/db.js";
import type { User } from "@/types/db/user.js";

export async function capture(
	this: PaymentService,
	userId: User["id"],
	data: CapturePaymentRequest,
	log: FastifyBaseLogger,
) {
	const { kysely, httpErrors, stripe, orderService } = this.fastify;

	const payment = await kysely
		.selectFrom("payment")
		.innerJoin("order", "order.id", "payment.orderId")
		.select([
			"payment.id as id",
			"payment.status as paymentStatus",
			"order.id as orderId",
			"order.status as orderStatus",
			"order.createdAt as orderCreatedAt",
		])
		.where("checkoutSessionId", "=", data.sessionId)
		.where("order.userId", "=", userId)
		.executeTakeFirst();

	if (!payment) {
		log.info("Capture payment failed: payment doesn't exist");
		throw httpErrors.notFound("Payment doesn't exist");
	}

	if (payment.orderStatus !== OrderStatus.Pending) {
		log.info({ orderId: payment.orderId }, "Order is not pending");
		throw httpErrors.badRequest("Order is not pending");
	}

	if (payment.paymentStatus !== PaymentStatus.Pending) {
		log.info(
			{ orderId: payment.orderId, paymentId: payment.id },
			"Payment is not pending",
		);
		throw httpErrors.badRequest("Payment is not pending");
	}

	if (orderService.isOrderExpired(payment.orderCreatedAt)) {
		await kysely.transaction().execute(async (trx) => {
			await Promise.all([
				trx
					.updateTable("order")
					.set({
						status: OrderStatus.Cancelled,
					})
					.where("id", "=", payment.orderId)
					.execute(),
				trx
					.updateTable("payment")
					.set({ status: PaymentStatus.Expired })
					.where("id", "=", payment.id)
					.execute(),
			]);
		});

		log.info("Capture payment failed: payment expired");
		throw httpErrors.badRequest("Payment expired");
	}

	try {
		const session = await stripe.checkout.sessions.retrieve(data.sessionId);

		if (session.payment_status !== "paid") {
			await kysely
				.updateTable("payment")
				.set({
					status:
						session.expires_at < Math.floor(Date.now() / 1000)
							? PaymentStatus.Expired
							: PaymentStatus.Failed,
				})
				.where("payment.id", "=", payment.id)
				.execute();

			log.info("Capture payment failed: payment not paid");
			throw httpErrors.badRequest("Payment not paid ");
		}

		await kysely.transaction().execute(async (trx) => {
			await Promise.all([
				trx
					.updateTable("order")
					.set({
						status: OrderStatus.Paid,
					})
					.where("id", "=", payment.orderId)
					.execute(),
				trx
					.updateTable("payment")
					.set({
						transactionId:
							typeof session.payment_intent === "string"
								? session.payment_intent
								: session.payment_intent!.id,
						status: PaymentStatus.Completed,
					})
					.where("id", "=", payment.id)
					.execute(),
			]);
		});
	} catch (err) {
		throw err;
	}
}
