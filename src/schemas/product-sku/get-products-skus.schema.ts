import z from "zod";
import {
	GetProductsSkusDefaultLimit,
	GetProductsSkusMaxLimit,
} from "../../const/zod.js";
import { GenericSchema, WithPageCountSchema } from "../base.schema.js";
import { ProductAdminSchema } from "../product/product.schema.js";
import { ProductSkuAdminSchema } from "./product-sku.schema.js";

export const GetProductsSkusRequestQuerySchema = z
	.object({
		search: z.string().trim().nonempty().optional(),
		isDeleted: z
			.enum(["true", "false"])
			.transform((val) => val === "true")
			.optional(),
		limit: z.coerce
			.number()
			.positive()
			.max(GetProductsSkusMaxLimit)
			.optional()
			.default(GetProductsSkusDefaultLimit),
		page: z.coerce.number().positive().optional().default(1),
		sku: z.string().optional(),
		minPrice: z.coerce.number().gte(0).optional(),
		maxPrice: z.coerce.number().positive().optional(),
		minSalePrice: z.coerce.number().gte(0).optional(),
		maxSalePrice: z.coerce.number().positive().optional(),
	})
	.refine((schema) => {
		if (schema.minPrice && schema.maxPrice)
			return schema.minPrice <= schema.maxPrice;

		return true;
	})
	.refine((schema) => {
		if (schema.minSalePrice && schema.maxSalePrice)
			return schema.minSalePrice <= schema.maxSalePrice;

		return true;
	});

export const GetProductsSkusResponseSchema = WithPageCountSchema(
	"productsSkus",
	z.array(GenericSchema("product", ProductSkuAdminSchema, ProductAdminSchema)),
);

export type GetProductsSkusRequestQuery = z.Infer<
	typeof GetProductsSkusRequestQuerySchema
>;
