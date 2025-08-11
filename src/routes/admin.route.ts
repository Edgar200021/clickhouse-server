import { Readable } from "node:stream";
import type { MultipartValue } from "@fastify/multipart";
import type { FastifyReply } from "fastify/types/reply.js";
import type { FastifyRequest } from "fastify/types/request.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import { ca } from "zod/v4/locales";
import {
	ErrorResponseSchema,
	SuccessResponseSchema,
	ValidationErrorResponseSchema,
} from "../schemas/base.schema.js";
import { CategoryParamSchema } from "../schemas/category/category-param.schema.js";
import {
	CreateCategoryRequestSchema,
	CreateCategoryResponseSchema,
} from "../schemas/category/create-category.schema.js";
import {
	UpdateCategoryRequestSchema,
	UpdateCategoryResponseSchema,
} from "../schemas/category/update-category.schema.js";
import { UserRole } from "../types/db/db.js";

const plugin: FastifyPluginAsyncZod = async (fastify) => {
	const { httpErrors, config, categoryService } = fastify;

	const multipartOnly = async (req: FastifyRequest, reply: FastifyReply) => {
		if (
			!req.headers["content-type"]?.includes("multipart/form-data") &&
			!req.headers["content-type"]?.includes(
				"application/x-www-form-urlencoded",
			)
		) {
			return reply.status(415).send({
				status: "error",
				error:
					"Unsupported Media Type, multipart/form-data or 'application/x-www-form-urlencoded required",
			});
		}
	};

	fastify.addHook("onRequest", async (req, reply) => {
		await req.authenticate(reply);
		await req.hasPermission([UserRole.Admin]);
	});

	fastify.get(
		"/admin",
		{
			preHandler: async (req, reply) => {
				await req.authenticate(reply);
			},
		},
		async (req, reply) => {
			reply.status(200).send({
				route: "admin",
			});
		},
	);

	fastify.post(
		"/admin/products",
		{
			preHandler: async (req, reply) => {
				await req.authenticate(reply);
			},
		},
		async (req, reply) => {
			reply.status(200).send({
				route: "admin",
			});
		},
	);

	fastify.post(
		"/admin/categories",
		{
			preHandler: multipartOnly,
			preValidation: async (req) => {
				if (
					req.headers["content-type"] !== "application/x-www-form-urlencoded"
				) {
					const formData = await req.formData();
					//@ts-expect-error ...
					req.body = Object.fromEntries(formData.entries());
				}
			},
			schema: {
				body: CreateCategoryRequestSchema,
				consumes: ["multipart/form-data"],
				response: {
					201: SuccessResponseSchema(CreateCategoryResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const category = await categoryService.createCategory(req.body, req.log);

			reply.status(201).send({
				status: "success",
				data: category,
			});
		},
	);

	fastify.patch(
		"/admin/categories/:categoryId",
		{
			preHandler: multipartOnly,
			preValidation: async (req) => {
				if (
					req.headers["content-type"] !== "application/x-www-form-urlencoded"
				) {
					const formData = await req.formData();
					req.body = Object.fromEntries(formData.entries());
				}
			},
			schema: {
				consumes: ["multipart/form-data"],
				params: CategoryParamSchema,
				body: UpdateCategoryRequestSchema,
				response: {
					200: SuccessResponseSchema(UpdateCategoryResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			console.log(req.body);

			if (
				Object.keys(req.body).length === 0 ||
				Object.values(req.body).some((v) => v === "undefined")
			) {
				throw httpErrors.badRequest("Request body is empty");
			}

			const category = await categoryService.updateCategory(
				req.body,
				req.params,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: category,
			});
		},
	);

	fastify.delete(
		"/admin/categories/:categoryId",
		{
			schema: {
				params: CategoryParamSchema,
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
			},
		},
		async (req, reply) => {
			await categoryService.deleteCategory(req.params, req.log);
			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);
};

export default plugin;
