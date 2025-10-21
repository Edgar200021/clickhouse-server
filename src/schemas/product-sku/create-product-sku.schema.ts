import z from "zod";
import {
	ProductSkuImageMaxSize,
	ProductSkuImagesMaxLength,
	ProductSkuImagesMinLength,
	ProductSkuPackagesMaxLength,
	ProductSkuPackagesMinLength,
} from "../../const/zod.js";
import { Currency } from "../../types/db/db.js";
import { ProductParamSchema } from "../product/product-param.schema.js";
import {
	ProductSkuAdminSchema,
	ProductSkuPackageSchema,
} from "./product-sku.schema.js";

export const CreateProductSkuRequestSchema = z
	.object({
		quantity: z.coerce.number().positive(),
		price: z.coerce.number().positive(),
		salePrice: z.coerce.number().positive().optional(),
		width: z.coerce.number().positive(),
		height: z.coerce.number().positive(),
		length: z.coerce.number().positive(),
		color: z
			.string()
			.trim()
			.nonempty()
			.refine((val) => Number.isNaN(Number(val)), {
				message: "Цвет не может быть числом",
			}),
		packages: ProductSkuPackageSchema.array()
			.min(ProductSkuPackagesMinLength)
			.max(ProductSkuPackagesMaxLength)
			.optional(),
		images: z
			.file()
			.max(ProductSkuImageMaxSize)
			.mime(["image/jpeg", "image/png", "image/webp"])
			.array()
			.min(ProductSkuImagesMinLength)
			.max(ProductSkuImagesMaxLength),
	})
	.merge(ProductParamSchema)
	.refine((obj) => (obj.salePrice ? obj.salePrice < obj.price : true), {
		error: "Sale price must be less than the regular price",
	});

export const CreateProductSkuResponseSchema = ProductSkuAdminSchema;

export type CreateProductSkuRequest = z.Infer<
	typeof CreateProductSkuRequestSchema
>;
