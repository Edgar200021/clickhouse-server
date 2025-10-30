import z from "zod";
import {
	GetPromocodesDefaultLimit,
	GetPromocodesMaxLimit,
} from "@/const/zod.js";
import { WithPageCountSchema } from "../base.schema.js";
import { PromocodeAdminSchema } from "./promocode.schema.js";

export const GetPromocodesRequestQuerySchema = z.object({
	limit: z.coerce
		.number()
		.positive()
		.max(GetPromocodesMaxLimit)
		.optional()
		.default(GetPromocodesDefaultLimit),
	page: z.coerce.number().positive().optional().default(1),
	search: z.string().trim().nonempty().optional(),
});

export const GetPromocodesResponseSchema = WithPageCountSchema(
	"promocodes",
	z.array(PromocodeAdminSchema),
);

export type GetPromocodesRequestQuery = z.infer<
	typeof GetPromocodesRequestQuerySchema
>;