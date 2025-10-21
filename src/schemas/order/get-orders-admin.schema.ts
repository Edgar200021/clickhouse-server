import z from "zod";
import { GetOrdersDefaultLimit, GetOrdersMaxLimit } from "../../const/zod.js";
import { OrderStatus } from "../../types/db/db.js";
import { OrderSchema } from "./order.schema.js";

export const GetOrdersAdminRequestQuerySchema = z.object({
	search: z.string().trim().nonempty().optional(),
	status: z.enum(OrderStatus).optional(),
	limit: z.coerce
		.number()
		.positive()
		.max(GetOrdersMaxLimit)
		.optional()
		.default(GetOrdersDefaultLimit),
	page: z.coerce.number().positive().optional().default(1),
});
export const GetOrdersResponseSchema = z.array(OrderSchema);

export type GetOrdersAdminRequestQuery = z.infer<
	typeof GetOrdersAdminRequestQuerySchema
>;
