import type {FastifyInstance} from "fastify";
import fp from "fastify-plugin";
import {capture} from "@/services/payment/capture.js";
import type {Order} from "@/types/db/order.js";
import {create} from "./create.js";
import {cancel} from "@/services/payment/cancel.js";

declare module "fastify" {
	export interface FastifyInstance {
		paymentService: PaymentService;
	}
}

export class PaymentService {
	create = create;
	capture = capture;
	cancel = cancel

	constructor(readonly fastify: FastifyInstance) {
		this.createRedirectUrls = this.createRedirectUrls.bind(this);
	}

	createRedirectUrls(orderNumber: Order["number"]) {
		return {
			successUrl: `${this.fastify.config.application.clientUrl}${this.fastify.config.application.clientOrdersPath}/${orderNumber}?sessionId={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${this.fastify.config.application.clientUrl}${this.fastify.config.application.clientOrdersPath}/${orderNumber}?sessionId={CHECKOUT_SESSION_ID}&type=cancel`,
		};
	}
}

export default fp(
	async (fastify: FastifyInstance) => {
		fastify.decorate("paymentService", new PaymentService(fastify));
	},
	{
		name: "paymentService",
		dependencies: ["orderService", "priceService"],
	},
);