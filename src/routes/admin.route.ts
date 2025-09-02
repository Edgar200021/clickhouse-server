import type { FastifyReply } from "fastify/types/reply.js";
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
import { ProductAdminSchema } from "../schemas/product/product.schema.js";
import { ProductParamSchema } from "../schemas/product/product-param.schema.js";
import { RemoveProductAssemblyInstructionRequestSchema } from "../schemas/product/remove-product-assembly-instruction.schema.js";
import {
	UpdateProductRequestSchema,
	UpdateProductResponseSchema,
} from "../schemas/product/update-product.schema.js";
import {
	CreateProductSkuRequestSchema,
	CreateProductSkuResponseSchema,
} from "../schemas/product-sku/create-product-sku.schema.js";
import {
	GetProductsSkusRequestQuerySchema,
	GetProductsSkusResponseSchema,
} from "../schemas/product-sku/get-products-skus.schema.js";
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
		productSkuService,
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
			onRequest: multipartOnly,
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
			const category = await categoryService.create(req.body, req.log);

			reply.status(201).send({
				status: "success",
				data: category,
			});
		},
	);

	fastify.patch(
		"/admin/categories/:categoryId",
		{
			onRequest: multipartOnly,
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
			if (Object.keys(req.body).length === 0) {
				throw httpErrors.badRequest("Request body is empty");
			}

			const category = await categoryService.update(
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
			await categoryService.remove(req.params, req.log);
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
			const { pageCount, users } = await userService.getALl(req.query);

			reply.status(200).send({
				status: "success",
				data: {
					pageCount,
					users: users.map((p) => ({
						...p,
						createdAt: p.createdAt.toISOString(),
						updatedAt: p.updatedAt.toISOString(),
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
			const { pageCount, products } = await productService.getAll(req.query);

			reply.status(200).send({
				status: "success",
				data: {
					pageCount,
					products: products.map((u) => ({
						...u,
						createdAt: u.createdAt.toISOString(),
						updatedAt: u.updatedAt.toISOString(),
					})),
				},
			});
		},
	);

	fastify.get(
		"/admin/products/:productId",
		{
			schema: {
				params: ProductParamSchema,
				response: {
					200: SuccessResponseSchema(ProductAdminSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const product = await productService.getById(req.params, req.log);

			reply.status(200).send({
				status: "success",
				data: {
					...product,
					createdAt: product.createdAt.toISOString(),
					updatedAt: product.updatedAt.toISOString(),
				},
			});
		},
	);

	fastify.post(
		"/admin/products",
		{
			onRequest: multipartOnly,
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

	fastify.patch(
		"/admin/products/:productId",
		{
			onRequest: multipartOnly,
			preValidation: async (req) => {
				if (
					req.headers["content-type"] !== "application/x-www-form-urlencoded"
				) {
					const formData = await req.formData();
					req.body = Object.fromEntries(formData.entries());
				}
			},
			schema: {
				body: UpdateProductRequestSchema,
				params: ProductParamSchema,
				consumes: ["multipart/form-data"],
				response: {
					200: SuccessResponseSchema(UpdateProductResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			if (Object.keys(req.body).length === 0) {
				throw httpErrors.badRequest("Request body is empty");
			}

			const product = await productService.update(
				req.body,
				req.params,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: {
					...product,
					createdAt: product.createdAt.toISOString(),
					updatedAt: product.updatedAt.toISOString(),
				},
			});
		},
	);

	fastify.delete(
		"/admin/products/:productId",
		{
			schema: {
				params: ProductParamSchema,
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			await productService.remove(req.params, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.delete(
		"/admin/products/:productId/assembly-instruction",
		{
			schema: {
				body: RemoveProductAssemblyInstructionRequestSchema,
				params: ProductParamSchema,
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			await productService.removeAssemblyInstruction(
				req.body,
				req.params,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.get(
		"/admin/products-sku",
		{
			schema: {
				querystring: GetProductsSkusRequestQuerySchema,
				response: {
					200: SuccessResponseSchema(GetProductsSkusResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const { pageCount, productsSkus } = await productSkuService.getAll(
				req.query,
			);

			reply.status(200).send({
				status: "success",
				data: {
					pageCount,
					productsSkus: productsSkus.map((u) => ({
						...u,
						packages: u.packages.map((p) => ({
							...p,
							createdAt: u.createdAt.toISOString(),
							updatedAt: u.updatedAt.toISOString(),
						})),
						createdAt: u.createdAt.toISOString(),
						updatedAt: u.updatedAt.toISOString(),
						product: {
							...u.product,
							createdAt: u.product.createdAt.toISOString(),
							updatedAt: u.product.updatedAt.toISOString(),
						},
					})),
				},
			});
		},
	);

	fastify.post(
		"/admin/products-sku",
		{
			onRequest: multipartOnly,
			preValidation: async (req) => {
				if (
					req.headers["content-type"] !== "application/x-www-form-urlencoded"
				) {
					const formData = await req.formData();
					const body: Record<string, unknown> = {};
					for (const [key, value] of formData.entries()) {
						if (body[key] && Array.isArray(body[key])) {
							body[key].push(
								key === "packages" ? JSON.parse(value as string) : value,
							);
						} else {
							body[key] =
								key === "images" || key === "packages"
									? [key === "packages" ? JSON.parse(value as string) : value]
									: value;
						}
					}

					//@ts-expect-error...
					req.body = body;
				}
			},
			schema: {
				body: CreateProductSkuRequestSchema,
				consumes: ["multipart/form-data"],
				response: {
					201: SuccessResponseSchema(CreateProductSkuResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const productSku = await productSkuService.create(req.body, req.log);

			reply.status(201).send({
				status: "success",
				data: {
					...productSku,
					packages: productSku.packages.map((p) => ({
						...p,
						createdAt: p.createdAt.toISOString(),
						updatedAt: p.updatedAt.toISOString(),
					})),
					createdAt: productSku.createdAt.toISOString(),
					updatedAt: productSku.updatedAt.toISOString(),
				},
			});
		},
	);
};

export default plugin;
