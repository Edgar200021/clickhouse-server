import z from "zod";
import { WithPageCountSchema } from "../base.schema.js";
import { GetOrdersAdminRequestQuerySchema } from "./get-orders-admin.schema.js";
import { OrderSchema } from "./order.schema.js";

export const GetOrdersRequestQuerySchema =
	GetOrdersAdminRequestQuerySchema.omit({ search: true });

export type GetOrdersRequestQuery = z.infer<typeof GetOrdersRequestQuerySchema>;

export const GetOrdersResponseSchema = WithPageCountSchema(
	"orders",
	z.array(OrderSchema),
);
