import z from "zod";
import { UserRole } from "../../types/db/db.js";

export const UserSchema = z.object({
	id: z.uuid(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	email: z.email().nullable(),
	isVerified: z.boolean(),
	role: z.enum(UserRole),
});
