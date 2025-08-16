import z from "zod";
import {
	GetProductsDefaultLimit,
	GetProductsMaxLimit,
} from "../../const/zod.js";
import { WithCountSchema } from "../base.schema.js";
import { ProductSchema } from "./product.schema.js";

export const GetProductsRequestQuerySchema = z.object({
	search: z.string().trim().nonempty().optional(),
	limit: z.coerce
		.number()
		.positive()
		.max(GetProductsMaxLimit)
		.optional()
		.default(GetProductsDefaultLimit),
	page: z.coerce.number().positive().optional().default(1),
});
export const GetProductsResponseSchema = WithCountSchema(
	"products",
	z.array(ProductSchema),
);

export type GetProductsRequestQuery = z.Infer<
	typeof GetProductsRequestQuerySchema
>;
