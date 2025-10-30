import type {FastifyPluginAsyncZod} from "fastify-type-provider-zod";
import z from "zod";
import {
	ErrorResponseSchema,
	SuccessResponseSchema,
	ValidationErrorResponseSchema,
} from "@/schemas/base.schema.js";
import {
	CapturePaymentRequestSchema,
	CapturePaymentResponseSchema,
} from "@/schemas/payment/capture-payment.schema.js";
import {
	CreatePaymentRequestSchema,
	CreatePaymentResponseSchema,
} from "@/schemas/payment/create-payment.schema.js";
import {
	CancelPaymentRequestSchema,
	CancelPaymentResponseSchema
} from "@/schemas/payment/cancel-payment.schema.js";

const plugin: FastifyPluginAsyncZod = async (fastify) => {
	const {config, paymentService} = fastify;

	fastify.addHook("onRequest", async (req, reply) => {
		await req.authenticate(reply);
	});

	fastify.post(
		"/",
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

			if (!user) return reply.unauthorized("Unauthorized");

			const redirectUrl = await paymentService.create(
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
		"/capture",
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

			if (!user) return reply.unauthorized("Unauthorized");

			await paymentService.capture(user.id, req.body, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.post(
		"/cancel",
		{
			schema: {
				body: CancelPaymentRequestSchema,
				response: {
					200: SuccessResponseSchema(CancelPaymentResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Payment"],
			},
		},
		async (req, reply) => {
			const user = req.user;

			if (!user) return reply.unauthorized("Unauthorized");

			await paymentService.cancel(user.id, req.body, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);
};

export default plugin;