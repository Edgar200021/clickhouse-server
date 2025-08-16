import type { FastifyRequest } from "fastify/types/request.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
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
import {
	CreateManufacturerRequestSchema,
	CreateManufacturerResponseSchema,
} from "../schemas/manufacturer/create-manufacturer.schema.js";
import { ManufacturerSchema } from "../schemas/manufacturer/manufacturer.schema.js";
import { ManufacturerParamSchema } from "../schemas/manufacturer/manufacturer-param.schema.js";
import {
	UpdateManufacturerRequestSchema,
	UpdateManufacturerResponseSchema,
} from "../schemas/manufacturer/update-manufacturer.schema.js";
import {
	CreateProductRequestSchema,
	CreateProductResponseSchema,
} from "../schemas/product/create-product.schema.js";
import {
	GetProductsRequestQuerySchema,
	GetProductsResponseSchema,
} from "../schemas/product/get-products.schema.js";
import { BlockToggleRequestSchema } from "../schemas/user/block-toggle.schema.js";
import {
	GetUsersRequestQuerySchema,
	GetUsersResponseSchema,
} from "../schemas/user/get-users.schema.js";
import { UserParamSchema } from "../schemas/user/user-param.schema.js";
import { UserRole } from "../types/db/db.js";

const plugin: FastifyPluginAsyncZod = async (fastify) => {
	const {
		httpErrors,
		categoryService,
		manufacturerService,
		userService,
		productService,
	} = fastify;

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

	fastify.get(
		"/admin/manufacturers",
		{
			schema: {
				response: {
					200: SuccessResponseSchema(z.array(ManufacturerSchema)),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (_, reply) => {
			const manufacturers = await manufacturerService.getManufacturers();

			reply.status(200).send({
				status: "success",
				data: manufacturers,
			});
		},
	);

	fastify.get(
		"/admin/manufacturers/:manufacturerId",
		{
			schema: {
				params: ManufacturerParamSchema,
				response: {
					200: SuccessResponseSchema(ManufacturerSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const manufacturer = await manufacturerService.getManufacturer(
				req.params,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: manufacturer,
			});
		},
	);

	fastify.post(
		"/admin/manufacturers",
		{
			schema: {
				body: CreateManufacturerRequestSchema,
				response: {
					201: SuccessResponseSchema(CreateManufacturerResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const manufacturer = await manufacturerService.createManufacturer(
				req.body,
				req.log,
			);

			reply.status(201).send({
				status: "success",
				data: manufacturer,
			});
		},
	);

	fastify.patch(
		"/admin/manufacturers/:manufacturerId",
		{
			schema: {
				params: ManufacturerParamSchema,
				body: UpdateManufacturerRequestSchema,
				response: {
					200: SuccessResponseSchema(UpdateManufacturerResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const manufacturer = await manufacturerService.updateManufacturer(
				req.body,
				req.params,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: manufacturer,
			});
		},
	);

	fastify.delete(
		"/admin/manufacturers/:manufacturerId",
		{
			schema: {
				params: ManufacturerParamSchema,
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
			},
		},
		async (req, reply) => {
			await manufacturerService.deleteManufacturer(req.params, req.log);
			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.get(
		"/admin/users",
		{
			schema: {
				querystring: GetUsersRequestQuerySchema,
				response: {
					200: SuccessResponseSchema(GetUsersResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const { totalCount, users } = await userService.getUsers(req.query);

			reply.status(200).send({
				status: "success",
				data: {
					totalCount,
					users: users.map((u) => ({
						...u,
						createdAt: u.createdAt.toISOString(),
						updatedAt: u.updatedAt.toISOString(),
					})),
				},
			});
		},
	);

	fastify.patch(
		"/admin/users/:userId/block-toggle",
		{
			schema: {
				params: UserParamSchema,
				body: BlockToggleRequestSchema,
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
				description: "Lock or unlock a user by ID",
			},
		},
		async (req, reply) => {
			await userService.blockToggle(req.body, req.params, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.get(
		"/admin/products",
		{
			schema: {
				querystring: GetProductsRequestQuerySchema,
				response: {
					200: SuccessResponseSchema(GetProductsResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const { totalCount, products } = await productService.getAll(req.query);

			reply.status(200).send({
				status: "success",
				data: {
					totalCount,
					products: products.map((u) => ({
						...u,
						createdAt: u.createdAt.toISOString(),
						updatedAt: u.updatedAt.toISOString(),
					})),
				},
			});
		},
	);

	fastify.post(
		"/admin/products",
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
				body: CreateProductRequestSchema,
				consumes: ["multipart/form-data"],
				response: {
					201: SuccessResponseSchema(CreateProductResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const product = await productService.create(req.body, req.log);

			reply.status(201).send({
				status: "success",
				data: {
					...product,
					createdAt: product.createdAt.toISOString(),
					updatedAt: product.updatedAt.toISOString(),
				},
			});
		},
	);
};

export default plugin;
