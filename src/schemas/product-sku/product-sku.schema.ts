import z from "zod";
import { Currency } from "../../types/db/db.js";

export const ProductSkuImageSchema = z.object({
	id: z.coerce.number(),
	imageId: z.string(),
	imageUrl: z.string(),
});

export const ProductSkuPackageSchema = z.object({
	length: z.number().positive(),
	quantity: z.number().positive(),
	width: z.number().positive(),
	height: z.number().positive(),
	weight: z.number().positive(),
});

export const ProductSkuPackageAdminSchema = ProductSkuPackageSchema.extend({
	id: z.number().positive(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

export const ProductSkuSchema = z.object({
	id: z.number().positive(),
	sku: z.string().nonempty(),
	quantity: z.number().gte(0),
	currency: z.enum(Currency),
	price: z.number().positive(),
	salePrice: z.number().positive().nullable(),
	attributes: z
		.object({
			color: z.string(),
			width: z.string(),
			height: z.string(),
			length: z.string(),
			weight: z.string().optional(),
		})
		.catchall(z.string()),
	images: ProductSkuImageSchema.array(),
	packages: ProductSkuPackageAdminSchema.array(),
});

export const ProductSkuAdminSchema = ProductSkuSchema.extend({
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

export type ProductSkuAttributes = z.Infer<
	typeof ProductSkuSchema
>["attributes"] &
	Record<string, string>;
