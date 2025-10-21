import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import {
	ErrorResponseSchema,
	SuccessResponseSchema,
	ValidationErrorResponseSchema,
} from "../schemas/base.schema.js";
import {
	CreateOrderRequestSchema,
	CreateOrderResponseSchema,
} from "../schemas/order/create-order.schema.js";
import {
	GetOrdersRequestQuerySchema,
	GetOrdersResponseSchema,
} from "../schemas/order/get-orders.schema.js";
import { SpecificOrderSchema } from "../schemas/order/order.schema.js";
import { OrderParamSchema } from "../schemas/order/order-param.schema.js";

const plugin: FastifyPluginAsyncZod = async (fastify) => {
	const { orderService } = fastify;

	fastify.addHook("onRequest", async (req, reply) => {
		await req.authenticate(reply);
	});

	fastify.post(
		"/order",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: fastify.config.rateLimit.createOrderLimit,
				},
			},
			schema: {
				body: CreateOrderRequestSchema,
				response: {
					201: SuccessResponseSchema(CreateOrderResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Order"],
			},
		},
		async (req, reply) => {
			const user = req.user;

			if (!user) return reply.unauthorized("Unautorized");

			const orderNumber = await orderService.create(user.id, req.body, req.log);

			reply.status(201).send({
				status: "success",
				data: {
					orderNumber,
				},
			});
		},
	);

	fastify.get(
		"/order",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: fastify.config.rateLimit.getOrdersLimit,
				},
			},
			schema: {
				querystring: GetOrdersRequestQuerySchema,
				response: {
					200: SuccessResponseSchema(GetOrdersResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Order"],
			},
		},
		async (req, reply) => {
			const user = req.user;

			if (!user) return reply.unauthorized("Unautorized");

			const { pageCount, orders } = await orderService.getAllByUserId(
				user.id,
				req.query,
			);

			reply.status(200).send({
				status: "success",
				data: {
					pageCount,
					orders: orders.map((order) => ({
						...order,
						createdAt: order.createdAt.toISOString(),
					})),
				},
			});
		},
	);

	fastify.get(
		"/order/:orderNumber",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: fastify.config.rateLimit.getOrderLimit,
				},
			},
			schema: {
				params: OrderParamSchema,
				response: {
					200: SuccessResponseSchema(SpecificOrderSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Order"],
			},
		},
		async (req, reply) => {
			const user = req.user;

			if (!user) return reply.unauthorized("Unautorized");

			const order = await orderService.getOneByUserId(
				user.id,
				req.params,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: { ...order, createdAt: order.createdAt.toISOString() },
			});
		},
	);
};

export default plugin;
