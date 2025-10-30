import type {FastifyPluginAsyncZod} from "fastify-type-provider-zod";
import z from "zod";
import {
	ErrorResponseSchema,
	SuccessResponseSchema,
	ValidationErrorResponseSchema,
} from "@/schemas/base.schema.js";
import {
	AddCartItemRequestSchema,
	AddCartItemResponseSchema,
} from "@/schemas/cart/add-cart-item.schema.js";
import {
	AddCartPromocodeRequestSchema,
	AddCartPromocodeResponseSchema,
} from "@/schemas/cart/add-cart-promocode.schema.js";
import {CartItemParamSchema} from "@/schemas/cart/cart-item-param.schema.js";
import {GetCartRequestQuerySchema, GetCartResponseSchema,} from "@/schemas/cart/get-cart.schema.js";
import {
	UpdateCartItemRequestSchema,
	UpdateCartItemResponseSchema,
} from "@/schemas/cart/update-cart-item.schema.js";

const plugin: FastifyPluginAsyncZod = async (fastify) => {
	const {cartService, config} = fastify;

	fastify.addHook("onRequest", async (req, reply) => {
		await req.authenticate(reply);
	});

	fastify.get(
		"/",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.getCartLimit,
				},
			},
			schema: {
				querystring: GetCartRequestQuerySchema,
				response: {
					200: SuccessResponseSchema(GetCartResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Cart"],
			},
		},
		async (req, reply) => {
			const user = req.user;
			if (!user) return reply.unauthorized("Unauthorized");

			const data = await cartService.getCart(user.id, req.query, req.log);

			reply.status(200).send({
				status: "success",
				data: {
					...data,
					promocode: data.promocode
						? {
							...data.promocode,
							validTo: data.promocode.validTo.toISOString(),
						}
						: null,
				},
			});
		},
	);

	fastify.post(
		"/promocode",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.addCartPromocodeLimit,
				},
			},
			schema: {
				body: AddCartPromocodeRequestSchema,
				response: {
					200: SuccessResponseSchema(AddCartPromocodeResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Cart"],
			},
		},
		async (req, reply) => {
			const user = req.user;
			if (!user) return reply.unauthorized("Unauthorized");
			const promocode = await cartService.addPromocode(
				user.id,
				req.body,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: {...promocode, validTo: promocode.validTo.toISOString()},
			});
		},
	);

	fastify.delete(
		"/promocode",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.deleteCartPromocodeLimit,
				},
			},
			schema: {
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Cart"],
			},
		},
		async (req, reply) => {
			const user = req.user;
			if (!user) return reply.unauthorized("Unauthorized");
			await cartService.deletePromocode(user.id, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.post(
		"/items",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.addCartItemLimit,
				},
			},
			schema: {
				body: AddCartItemRequestSchema,
				response: {
					201: SuccessResponseSchema(AddCartItemResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Cart"],
			},
		},
		async (req, reply) => {
			const user = req.user;
			if (!user) return reply.unauthorized("Unauthorized");

			await cartService.addCartItem(user.id, req.body, req.log);

			reply.status(201).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.patch(
		"/items/:cartItemId",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.updateCartItemLimit,
				},
			},
			schema: {
				params: CartItemParamSchema,
				body: UpdateCartItemRequestSchema,
				response: {
					200: SuccessResponseSchema(UpdateCartItemResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Cart"],
			},
		},
		async (req, reply) => {
			const user = req.user;
			if (!user) return reply.unauthorized("Unauthorized");

			await cartService.updateCartItem(user.id, req.body, req.params, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.delete(
		"/items/:cartItemId",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.deleteCartItemLimit,
				},
			},
			schema: {
				params: CartItemParamSchema,
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Cart"],
			},
		},
		async (req, reply) => {
			const user = req.user;
			if (!user) return reply.unauthorized("Unauthorized");

			await cartService.deleteCartItem(user.id, req.params, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.post(
		"/items/clear",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.clearCartLimit,
				},
			},
			schema: {
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Cart"],
			},
		},
		async (req, reply) => {
			const user = req.user;
			if (!user) return reply.unauthorized("Unauthorized");

			await cartService.clearCart(user.id, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);
};

export default plugin;