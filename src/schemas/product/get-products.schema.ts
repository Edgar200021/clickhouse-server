import z from "zod";
import {
	GetProductsDefaultLimit,
	GetProductsMaxLimit,
} from "@/const/zod.js";
import { WithPageCountSchema } from "../base.schema.js";
import { ProductAdminSchema } from "./product.schema.js";

export const GetProductsRequestQuerySchema = z.object({
	search: z.string().trim().nonempty().optional(),
	isDeleted: z
		.enum(["true", "false"])
		.transform((val) => val === "true")
		.optional(),
	limit: z.coerce
		.number()
		.positive()
		.max(GetProductsMaxLimit)
		.optional()
		.default(GetProductsDefaultLimit),
	page: z.coerce.number().positive().optional().default(1),
});
export const GetProductsResponseSchema = WithPageCountSchema(
	"products",
	z.array(ProductAdminSchema),
);

export type GetProductsRequestQuery = z.Infer<
	typeof GetProductsRequestQuerySchema
>;