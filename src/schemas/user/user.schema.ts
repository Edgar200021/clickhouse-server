import { Type } from "@sinclair/typebox";
import { UserRole } from "../../types/db/db.js";
import { NullableSchema } from "../base.schema.js";

export const UserSchema = Type.Object({
	id: Type.String({ format: "uuid" }),
	createdAt: Type.String({ format: "date-time" }),
	updatedAt: Type.String({ format: "date-time" }),
	email: NullableSchema(Type.String({ format: "email" })),
	isVerified: Type.Boolean(),
	role: Type.Enum(UserRole),
});
