import type { FastifyBaseLogger } from "fastify";
import type { CreatePaymentRequest } from "@/schemas/payment/create-payment.schema.js";
import type { PaymentService } from "@/services/payment/payment.service.js";
import { OrderStatus } from "@/types/db/db.js";
import type { User } from "@/types/db/user.js";

export async function create(
	this: PaymentService,
	userId: User["id"],
	data: CreatePaymentRequest,
	log: FastifyBaseLogger,
) {
	const {
		fastify: { orderService, httpErrors, stripe, priceService, kysely },
		createRedirectUrls,
	} = this;

	const order = await orderService.getOneByUserId(userId, data, log);

	if (order.status !== OrderStatus.Pending) {
		log.info(
			{ orderNumber: order.number },
			"Create payment failed: Order is not pending",
		);

		throw httpErrors.badRequest("Create payment failed: Order is not pending");
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
