import type {FastifyReply} from "fastify/types/reply.js";
import type {FastifyRequest} from "fastify/types/request.js";
import type {FastifyPluginAsyncZod} from "fastify-type-provider-zod";
import z from "zod";
import {
	ErrorResponseSchema,
	GenericSchema,
	SuccessResponseSchema,
	ValidationErrorResponseSchema,
} from "@/schemas/base.schema.js";
import {CategoryParamSchema} from "@/schemas/category/category-param.schema.js";
import {
	CreateCategoryRequestSchema,
	CreateCategoryResponseSchema,
} from "@/schemas/category/create-category.schema.js";
import {
	UpdateCategoryRequestSchema,
	UpdateCategoryResponseSchema,
} from "@/schemas/category/update-category.schema.js";
import {
	CreateManufacturerRequestSchema,
	CreateManufacturerResponseSchema,
} from "@/schemas/manufacturer/create-manufacturer.schema.js";
import {ManufacturerSchema} from "@/schemas/manufacturer/manufacturer.schema.js";
import {ManufacturerParamSchema} from "@/schemas/manufacturer/manufacturer-param.schema.js";
import {
	UpdateManufacturerRequestSchema,
	UpdateManufacturerResponseSchema,
} from "@/schemas/manufacturer/update-manufacturer.schema.js";
import {
	GetOrdersAdminRequestQuerySchema,
	GetOrdersAdminResponseSchema,
} from "@/schemas/order/get-orders-admin.schema.js";
import {SpecificAdminOrderSchema} from "@/schemas/order/order.schema.js";
import {OrderParamSchema} from "@/schemas/order/order-param.schema.js";
import {
	CreateProductRequestSchema,
	CreateProductResponseSchema,
} from "@/schemas/product/create-product.schema.js";
import {
	GetProductsRequestQuerySchema,
	GetProductsResponseSchema,
} from "@/schemas/product/get-products.schema.js";
import {ProductAdminSchema} from "@/schemas/product/product.schema.js";
import {ProductParamSchema} from "@/schemas/product/product-param.schema.js";
import {
	RemoveProductAssemblyInstructionRequestSchema
} from "@/schemas/product/remove-product-assembly-instruction.schema.js";
import {
	UpdateProductRequestSchema,
	UpdateProductResponseSchema,
} from "@/schemas/product/update-product.schema.js";
import {
	CreateProductSkuRequestSchema,
	CreateProductSkuResponseSchema,
} from "@/schemas/product-sku/create-product-sku.schema.js";
import {
	GetProductsSkusAdminRequestQuerySchema,
	GetProductsSkusAdminResponseSchema,
} from "@/schemas/product-sku/get-products-skus-admin.schema.js";
import {ProductSkuAdminSchema} from "@/schemas/product-sku/product-sku.schema.js";
import {ProductSkuParamSchema} from "@/schemas/product-sku/product-sku-param.schema.js";
import {
	UpdateProductSkuRequestSchema,
	UpdateProductSkuResponseSchema,
} from "@/schemas/product-sku/update-product-sku.schema.js";
import {
	CreatePromocodeRequestSchema,
	CreatePromocodeResponseSchema,
} from "@/schemas/promocode/create-promocode.schema.js";
import {
	GetPromocodesRequestQuerySchema,
	GetPromocodesResponseSchema,
} from "@/schemas/promocode/get-promocodes.schema.js";
import {PromocodeAdminSchema} from "@/schemas/promocode/promocode.schema.js";
import {PromocodeParamSchema} from "@/schemas/promocode/promocode-param.schema.js";
import {
	UpdatePromocodeRequestSchema,
	UpdatePromocodeResponseSchema,
} from "@/schemas/promocode/update-promocode.schema.js";
import {BlockToggleRequestSchema} from "@/schemas/user/block-toggle.schema.js";
import {
	GetUsersRequestQuerySchema,
	GetUsersResponseSchema,
} from "@/schemas/user/get-users.schema.js";
import {UserParamSchema} from "@/schemas/user/user-param.schema.js";
import {UserRole} from "@/types/db/db.js";

const plugin: FastifyPluginAsyncZod = async (fastify) => {
	const {
		httpErrors,
		categoryService,
		manufacturerService,
		userService,
		productService,
		productSkuService,
		promocodeService,
		orderService,
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
		"/categories",
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
		"/categories/:categoryId",
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
		"/categories/:categoryId",
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
		"/manufacturers",
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
			const manufacturers = await manufacturerService.getAll();

			reply.status(200).send({
				status: "success",
				data: manufacturers,
			});
		},
	);

	fastify.get(
		"/manufacturers/:manufacturerId",
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
			const manufacturer = await manufacturerService.get(
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
		"/manufacturers",
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
			const manufacturer = await manufacturerService.create(
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
		"/manufacturers/:manufacturerId",
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
			const manufacturer = await manufacturerService.update(
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
		"/manufacturers/:manufacturerId",
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
			await manufacturerService.remove(req.params, req.log);
			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.get(
		"/users",
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
			const {pageCount, users} = await userService.getAll(req.query);

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
		"/users/:userId/block-toggle",
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
		"/products",
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
			const {pageCount, products} = await productService.getAll(req.query);

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
		"/products/:productId",
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
		"/products",
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
		"/products/:productId",
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
		"/products/:productId",
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
		"/products/:productId/assembly-instruction",
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
		"/products-sku",
		{
			schema: {
				querystring: GetProductsSkusAdminRequestQuerySchema,
				response: {
					200: SuccessResponseSchema(GetProductsSkusAdminResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const {pageCount, productsSkus} = await productSkuService.getAll(
				req.query,
				UserRole.Admin,
			);

			reply.status(200).send({
				status: "success",
				data: {
					pageCount,
					productsSkus: productsSkus.map((u) => ({
						...u,
						createdAt: u.createdAt.toISOString(),
						updatedAt: u.updatedAt.toISOString(),
						packages: u.packages.map((p) => ({
							...p,
							createdAt: new Date(p.createdAt).toISOString(),
							updatedAt: new Date(p.updatedAt).toISOString(),
						})),
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

	fastify.get(
		"/products-sku/popular",
		{
			schema: {
				response: {
					200: SuccessResponseSchema(z.array(GenericSchema(ProductSkuAdminSchema, "product", ProductAdminSchema)),),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const data = await productSkuService.getPopularProducts(
				UserRole.Admin,
			);

			reply.status(200).send({
				status: "success",
				data
			});
		},
	);

	fastify.get(
		"/products-sku/:productSkuId",
		{
			schema: {
				params: ProductSkuParamSchema,
				response: {
					200: SuccessResponseSchema(
						GenericSchema(ProductSkuAdminSchema, "product", ProductAdminSchema),
					),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const productSku = await productSkuService.getOne(
				req.params,
				UserRole.Admin,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: {
					...productSku,
					packages: productSku.packages.map((p) => ({
						...p,
						createdAt: new Date(p.createdAt).toISOString(),
						updatedAt: new Date(p.updatedAt).toISOString(),
					})),
					createdAt: productSku.createdAt.toISOString(),
					updatedAt: productSku.updatedAt.toISOString(),
					product: {
						...productSku.product,
						createdAt: productSku.product.createdAt.toISOString(),
						updatedAt: productSku.product.updatedAt.toISOString(),
					},
				},
			});
		},
	);

	fastify.post(
		"/products-sku",
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
						createdAt: new Date(p.createdAt).toISOString(),
						updatedAt: new Date(p.updatedAt).toISOString(),
					})),
					createdAt: productSku.createdAt.toISOString(),
					updatedAt: productSku.updatedAt.toISOString(),
				},
			});
		},
	);

	fastify.post(
		"/products-sku/popular",
		{
			schema: {
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const productSku = await productSkuService.updatePopularProductsCache();

			reply.status(200).send({
				status: "success",
				data: null
			});
		},
	);


	fastify.patch(
		"/products-sku/:productSkuId",
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

					req.body = body;
				}

				if (req.body.packages) {
					if (!Array.isArray(req.body.packages)) {
						req.body.packages = [req.body.packages];
					}
					req.body.packages = req.body.packages.map((pkg) => {
						return typeof pkg === "string" ? JSON.parse(pkg) : pkg;
					});
				}
			},
			schema: {
				params: ProductSkuParamSchema,
				body: UpdateProductSkuRequestSchema,
				consumes: ["multipart/form-data"],
				response: {
					200: SuccessResponseSchema(UpdateProductSkuResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			if (Object.keys(req.body).length === 0) {
				throw httpErrors.badRequest("Request body is empty");
			}

			const productSku = await productSkuService.update(
				req.body,
				req.params,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: {
					...productSku,
					packages: productSku.packages.map((p) => ({
						...p,
						createdAt: new Date(p.createdAt).toISOString(),
						updatedAt: new Date(p.updatedAt).toISOString(),
					})),
					createdAt: productSku.createdAt.toISOString(),
					updatedAt: productSku.updatedAt.toISOString(),
				},
			});
		},
	);

	fastify.delete(
		"/products-sku/:productSkuId",
		{
			schema: {
				params: ProductSkuParamSchema,
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			await productSkuService.remove(req.params, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.delete(
		"/products-sku/:productSkuId/images/:imageId",
		{
			schema: {
				params: GenericSchema(
					ProductSkuParamSchema,
					"imageId",
					z.coerce.number().positive(),
				),
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			await productSkuService.deleteImage(req.params, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.delete(
		"/products-sku/:productSkuId/packages/:packageId",
		{
			schema: {
				params: GenericSchema(
					ProductSkuParamSchema,
					"packageId",
					z.coerce.number().positive(),
				),
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			await productSkuService.deletePackage(req.params, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.get(
		"/promocode",
		{
			schema: {
				querystring: GetPromocodesRequestQuerySchema,
				response: {
					200: SuccessResponseSchema(GetPromocodesResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const {pageCount, promocodes} = await promocodeService.getAll(
				req.query,
			);

			reply.status(200).send({
				status: "success",
				data: {
					pageCount,
					promocodes: promocodes.map((promocode) => ({
						...promocode,
						createdAt: promocode.createdAt.toISOString(),
						updatedAt: promocode.updatedAt.toISOString(),
						validFrom: promocode.validFrom.toISOString(),
						validTo: promocode.validTo.toISOString(),
					})),
				},
			});
		},
	);

	fastify.get(
		"/promocode/:promocodeId",
		{
			schema: {
				params: PromocodeParamSchema,
				response: {
					200: SuccessResponseSchema(PromocodeAdminSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const promocode = await promocodeService.get({
				type: "id",
				id: req.params.promocodeId,
			});

			if (!promocode) {
				req.log.info(req.params, "promocode not found");
				throw httpErrors.notFound("Promocode not found");
			}

			reply.status(200).send({
				status: "success",
				data: {
					...promocode,
					createdAt: promocode.createdAt.toISOString(),
					updatedAt: promocode.updatedAt.toISOString(),
					validFrom: promocode.validFrom.toISOString(),
					validTo: promocode.validTo.toISOString(),
				},
			});
		},
	);

	fastify.post(
		"/promocode",
		{
			schema: {
				body: CreatePromocodeRequestSchema,
				response: {
					201: SuccessResponseSchema(CreatePromocodeResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const promocode = await promocodeService.create(req.body, req.log);

			reply.status(201).send({
				status: "success",
				data: {
					...promocode,
					createdAt: promocode.createdAt.toISOString(),
					updatedAt: promocode.updatedAt.toISOString(),
					validFrom: promocode.validFrom.toISOString(),
					validTo: promocode.validTo.toISOString(),
				},
			});
		},
	);

	fastify.patch(
		"/promocode/:promocodeId",
		{
			schema: {
				body: UpdatePromocodeRequestSchema,
				params: PromocodeParamSchema,
				response: {
					200: SuccessResponseSchema(UpdatePromocodeResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			if (Object.keys(req.body).length === 0) {
				throw httpErrors.badRequest("Request body is empty");
			}

			const promocode = await promocodeService.update(
				req.body,
				req.params,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: {
					...promocode,
					createdAt: promocode.createdAt.toISOString(),
					updatedAt: promocode.updatedAt.toISOString(),
					validFrom: promocode.validFrom.toISOString(),
					validTo: promocode.validTo.toISOString(),
				},
			});
		},
	);

	fastify.delete(
		"/promocode/:promocodeId",
		{
			schema: {
				params: PromocodeParamSchema,
				response: {
					200: SuccessResponseSchema(z.null()),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			await promocodeService.remove(req.params, req.log);
			reply.status(200).send({
				status: "success",
				data: null,
			});
		},
	);

	fastify.get(
		"/order",
		{
			schema: {
				querystring: GetOrdersAdminRequestQuerySchema,
				response: {
					200: SuccessResponseSchema(GetOrdersAdminResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const {pageCount, orders} = await orderService.getAll(req.query);

			reply.status(200).send({
				status: "success",
				data: {
					pageCount,
					orders: orders.map((order) => ({
						...order,
						createdAt: order.createdAt.toISOString(),
						updatedAt: order.updatedAt.toISOString(),
					})),
				},
			});
		},
	);

	fastify.get(
		"/order/:orderNumber",
		{
			schema: {
				params: OrderParamSchema,
				response: {
					200: SuccessResponseSchema(SpecificAdminOrderSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Admin"],
			},
		},
		async (req, reply) => {
			const order = await orderService.getOne(req.params, req.log);

			reply.status(200).send({
				status: "success",
				data: {
					...order,
					createdAt: order.createdAt.toISOString(),
				},
			});
		},
	);
};

export default plugin;