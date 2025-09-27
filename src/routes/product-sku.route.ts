import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import {
	ErrorResponseSchema,
	GenericSchema,
	SuccessResponseSchema,
	ValidationErrorResponseSchema,
} from "../schemas/base.schema.js";
import { ProductSchema } from "../schemas/product/product.schema.js";
import {
	GetProductsSkusRequestQuerySchema,
	GetProductsSkusResponseSchema,
} from "../schemas/product-sku/get-products-skus.schema.js";
import { ProductSkuSchema } from "../schemas/product-sku/product-sku.schema.js";
import { ProductSkuParamSchema } from "../schemas/product-sku/product-sku-param.schema.js";
import { UserRole } from "../types/db/db.js";

const plugin: FastifyPluginAsyncZod = async (fastify) => {
	const { productSkuService, config } = fastify;

	fastify.get(
		"/product-sku",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.getProductsSkusLimit,
				},
			},
			schema: {
				querystring: GetProductsSkusRequestQuerySchema,
				response: {
					200: SuccessResponseSchema(GetProductsSkusResponseSchema),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["ProductSku"],
			},
		},
		async (req, reply) => {
			const { productsSkus, pageCount } = await productSkuService.getAll(
				req.query,
				UserRole.Regular,
			);

			reply.status(200).send({
				status: "success",
				data: {
					pageCount,
					productsSkus: productsSkus.map((u) => ({
						...u,
						packages: u.packages,
						product: u.product,
					})),
				},
			});
		},
	);

	fastify.get(
		"/product-sku/:productSkuId",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.getProductsSkusLimit,
				},
			},
			schema: {
				params: ProductSkuParamSchema,
				response: {
					200: SuccessResponseSchema(
						GenericSchema(ProductSkuSchema, "product", ProductSchema),
					),
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["ProductSku"],
			},
		},
		async (req, reply) => {
			const productSku = await productSkuService.getOne(
				req.params,
				UserRole.Regular,
				req.log,
			);

			reply.status(200).send({
				status: "success",
				data: productSku,
			});
		},
	);
};

export default plugin;
