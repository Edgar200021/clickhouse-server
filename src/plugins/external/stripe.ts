import {
	Client,
	type Configuration,
	type Environment,
	type OAuthToken,
} from "@paypal/paypal-server-sdk";
import type { FastifyInstance } from "fastify/types/instance.js";
import fp from "fastify-plugin";
import Stripe from "stripe";
import { PaypalTokenKey } from "../../const/redis.js";

declare module "fastify" {
	export interface FastifyInstance {
		stripe: Stripe;
	}
}

export default fp(
	async (fastify: FastifyInstance) => {
		fastify.decorate(
			"stripe",
			new Stripe(fastify.config.stripe.secretKey, {
				typescript: true,
				appInfo: {
					name: "Clickhouse",
					version: "1",
				},
			}),
		);
	},
	{ name: "stripe" },
);
