import { httpErrors } from "@fastify/sensible";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { CapturePaymentRequest } from "../schemas/payment/capture-payment.schema.js";
import type { CreatePaymentRequest } from "../schemas/payment/create-payment.schema.js";
import { OrderStatus, PaymentStatus } from "../types/db/db.js";
import type { Order } from "../types/db/order.js";
import type { User } from "../types/db/user.js";

export function createPaymentService(instance: FastifyInstance) {
	const { kysely, orderService, priceService, stripe, config } = instance;

	async function createPayment(
		userId: User["id"],
		data: CreatePaymentRequest,
		log: FastifyBaseLogger,
	) {
		const order = await orderService.getOneByUserId(userId, data, log);

		if (order.status !== OrderStatus.Pending) {
			log.info(
				{ orderNumber: order.number },
				"Create payment failed: Order is not pending",
			);
			throw httpErrors.badRequest(
				"Create payment failed: Order is not pending",
			);
		}

		if (orderService.isOrderExpired(order.createdAt)) {
			log.info("Create payment failed: payment expired");
			throw httpErrors.badRequest("Payment expired");
		}

		try {
			const { successUrl, cancelUrl } = createRedirectUrls(order.number);

			const session = await stripe.checkout.sessions.create({
				mode: "payment",
				success_url: successUrl,
				cancel_url: cancelUrl,
				payment_method_types: ["card"],
				customer_email: order.email,
				line_items: order.orderItems.map((item) => ({
					price_data: {
						currency: order.currency.toLowerCase(),
						product_data: {
							name: item.name,
							images: [item.image],
						},
						unit_amount: priceService.transformPrice(
							item.price,
							order.currency,
							"store",
						),
					},
					quantity: item.quantity,
				})),
			});

			if (!session.url) {
				log.warn(
					"Create payment failed: Stripe API Error during order creation, empty redirect url",
				);
				throw httpErrors.badGateway("Payment service is currently unavailable");
			}

			const row = await kysely
				.insertInto("payment")
				.values({
					checkoutSessionId: session.id,
					amount: order.total,
					orderId: (
						await kysely
							.selectFrom("order")
							.select("id")
							.where("number", "=", order.number)
							.executeTakeFirstOrThrow()
					).id,
				})
				.returning("id")
				.executeTakeFirst();

			if (!row) {
				log.warn("Create payment failed: can't create payment in database");
				throw httpErrors.internalServerError("Something went wrong");
			}

			return session.url;
		} catch (err) {
			log.error({ err }, "Stripe session creation failed");
			throw httpErrors.badGateway("Failed to create payment session");
		}
	}

	async function capturePayment(
		userId: User["id"],
		data: CapturePaymentRequest,
		log: FastifyBaseLogger,
	) {
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

	function createRedirectUrls(orderNumber: Order["number"]) {
		return {
			successUrl: `${config.application.clientUrl}${config.application.clientOrdersPath}/${orderNumber}?sessionId={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${config.application.clientUrl}${config.application.clientOrdersPath}/${orderNumber}`,
		};
	}

	return {
		createPayment,
		capturePayment,
	};
}
