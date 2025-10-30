import z from "zod";
import { GetUsersDefaultLimit, GetUsersMaxLimit } from "@/const/zod.js";
import { WithPageCountSchema } from "../base.schema.js";
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
	isVerified: z
		.enum(["true", "false"])
		.transform((val) => val === "true")
		.optional(),
	isBanned: z
		.enum(["true", "false"])
		.transform((val) => val === "true")
		.optional(),
});
export const GetUsersResponseSchema = WithPageCountSchema(
	"users",
	z.array(AdminUserSchema),
);

export type GetUsersRequestQuery = z.Infer<typeof GetUsersRequestQuerySchema>;