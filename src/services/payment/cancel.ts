import {PaymentService} from "@/services/payment/payment.service.js";
import {User} from "@/types/db/user.js";
import {CancelPaymentRequest} from "@/schemas/payment/cancel-payment.schema.js";
import {FastifyBaseLogger} from "fastify";
import {OrderStatus, PaymentStatus} from "@/types/db/db.js";

export async function cancel(this: PaymentService, userId: User["id"], data: CancelPaymentRequest, log: FastifyBaseLogger) {
	const {kysely, httpErrors} = this.fastify;

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
		log.info("Cancel payment failed: payment doesn't exist");
		throw httpErrors.notFound("Payment doesn't exist");
	}

	if (payment.orderStatus !== OrderStatus.Pending) {
		log.info({orderId: payment.orderId}, "Cancel payment failed: Order is not pending");
		throw httpErrors.badRequest("Order is not pending");
	}

	if (payment.paymentStatus !== PaymentStatus.Pending) {
		log.info(
			{orderId: payment.orderId, paymentId: payment.id},
			"Cancel payment failed: Payment is not pending",
		);
		throw httpErrors.badRequest("Payment is not pending");
	}

	await kysely.updateTable("payment").set({
		status: PaymentStatus.Cancelled
	}).where("id", "=", payment.id).execute()
}