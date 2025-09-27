import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import {
	ErrorResponseSchema,
	SuccessResponseSchema,
	ValidationErrorResponseSchema,
} from "../schemas/base.schema.js";
import {
	AddCartItemRequestSchema,
	AddCartItemResponseSchema,
} from "../schemas/cart/add-cart-item.schema.js";
import {
	AddCartPromocodeRequestSchema,
	AddCartPromocodeResponseSchema,
} from "../schemas/cart/add-cart-promocode.schema.js";
import { CartItemParamSchema } from "../schemas/cart/cart-item-param.schema.js";
import { GetCartResponseSchema } from "../schemas/cart/get-cart.schema.js";
import {
	UpdateCartItemRequestSchema,
	UpdateCartItemResponseSchema,
} from "../schemas/cart/update-cart-item.schema.js";

const plugin: FastifyPluginAsyncZod = async (fastify) => {
	const { cartService, config } = fastify;

	fastify.get(
		"/cart",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.getCartLimit,
				},
			},
			onRequest: async (req, reply) => {
				await req.authenticate(reply);
			},
			schema: {
				response: {
					200: SuccessResponseSchema(GetCartResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Cart"],
			},
		},
		async (req, reply) => {
			const user = req.user;
			if (!user) return reply.unauthorized("Unautorized");
			const data = await cartService.getCart(user.id);

			reply.status(200).send({
				status: "success",
				data: {
					totalPrice: data.totalPrice,
					promocode: data.promocode
						? {
								...data.promocode,
								validTo: data.promocode.validTo.toISOString(),
							}
						: null,
					cartItems: data.cartItems,
				},
			});
		},
	);

	fastify.post(
		"/cart/promocode",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.addCartPromocodeLimit,
				},
			},
			onRequest: async (req, reply) => {
				await req.authenticate(reply);
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
			if (!user) return reply.unauthorized("Unautorized");
			const promocode = await cartService.addPromocode(
				user.id,
				req.body,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: { ...promocode, validTo: promocode.validTo.toISOString() },
			});
		},
	);

	fastify.post(
		"/cart/items",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.addCartItemLimit,
				},
			},
			onRequest: async (req, reply) => {
				await req.authenticate(reply);
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
			if (!user) return reply.unauthorized("Unautorized");

			await cartService.addCartItem(user.id, req.body, req.log);

			reply.status(201).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.patch(
		"/cart/items/:cartItemId",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.updateCartItemLimit,
				},
			},
			onRequest: async (req, reply) => {
				await req.authenticate(reply);
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
		"/cart/items/:cartItemId",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.deleteCartItemLimit,
				},
			},
			onRequest: async (req, reply) => {
				await req.authenticate(reply);
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
			if (!user) return reply.unauthorized("Unautorized");

			await cartService.deleteCartItem(user.id, req.params, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.post(
		"/cart/items/clear",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.clearCartLimit,
				},
			},
			onRequest: async (req, reply) => {
				await req.authenticate(reply);
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
