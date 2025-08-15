import z from "zod";
import { GetUsersDefaultLimit, GetUsersMaxLimit } from "../../const/zod.js";
import { WithCountSchema } from "../base.schema.js";
import { AdminUserSchema } from "./user.schema.js";

export const GetUsersRequestQuerySchema = z.object({
	search: z.string().trim().nonempty().optional(),
	limit: z.coerce
		.number()
		.positive()
		.max(GetUsersMaxLimit)
		.optional()
		.default(GetUsersDefaultLimit),
	page: z.coerce.number().positive().optional().default(1),
	isVerified: z.coerce.boolean().optional(),
	isBanned: z.coerce.boolean().optional(),
});
export const GetUsersResponseSchema = WithCountSchema(
	"users",
	z.array(AdminUserSchema),
);

export type GetUsersRequestQuery = z.Infer<typeof GetUsersRequestQuerySchema>;
