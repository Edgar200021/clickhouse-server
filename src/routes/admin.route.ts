import { Readable } from "node:stream";
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

	fastify.addHook("onRequest", async (req, reply) => {
		await req.authenticate(reply);
		req.hasPermission(reply, [UserRole.Admin]);
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
			preValidation: async (req) => {
				const formData = await req.formData();
				//@ts-expect-error ...
				req.body = Object.fromEntries(formData.entries());
			},
			schema: {
				body: CreateCategoryRequestSchema,
				consumes: ["multipart/form-data"],
				response: {
					201: SuccessResponseSchema(CreateCategoryResponseSchema),
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
			schema: {
				params: CategoryParamSchema,
				body: UpdateCategoryRequestSchema,
				response: {
					200: SuccessResponseSchema(UpdateCategoryResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
			},
		},
		async (req, reply) => {
			reply.status(200).send({
				status: "success",
				data: {
					id: 1,
					name: "",
					path: "",
					imageId: null,
					imageUrl: null,
				},
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
			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);
};

export default plugin;
