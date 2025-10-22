import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import {
	ErrorResponseSchema,
	SuccessResponseSchema,
	ValidationErrorResponseSchema,
} from "../schemas/base.schema.js";
import {
	CapturePaymentRequestSchema,
	CapturePaymentResponseSchema,
} from "../schemas/payment/capture-payment.schema.js";
import {
	CreatePaymentRequestSchema,
	CreatePaymentResponseSchema,
} from "../schemas/payment/create-payment.schema.js";

const plugin: FastifyPluginAsyncZod = async (fastify) => {
	const { config, paymentService } = fastify;

	fastify.addHook("onRequest", async (req, reply) => {
		await req.authenticate(reply);
	});

	fastify.post(
		"/payment",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.createPaymentLimit,
				},
			},
			schema: {
				body: CreatePaymentRequestSchema,
				response: {
					201: SuccessResponseSchema(CreatePaymentResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Payment"],
			},
		},
		async (req, reply) => {
			const user = req.user;

			if (!user) return reply.unauthorized("Unautorized");

			const redirectUrl = await paymentService.createPayment(
				user.id,
				req.body,
				req.log,
			);

			reply.status(201).send({
				status: "success",
				data: {
					redirectUrl,
				},
			});
		},
	);

	fastify.post(
		"/payment/capture",
		{
			schema: {
				body: CapturePaymentRequestSchema,
				response: {
					200: SuccessResponseSchema(CapturePaymentResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Payment"],
			},
		},
		async (req, reply) => {
			const user = req.user;

			if (!user) return reply.unauthorized("Unautorized");

			await paymentService.capturePayment(user.id, req.body, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);
};

export default plugin;
