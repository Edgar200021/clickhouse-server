import { Type } from "@sinclair/typebox";
import { UserSchema } from "../user.schema.js";

export const VerifyAccountSchemaRequest = Type.Object({
	token: Type.String(),
});
export const VerifyAccountSchemaResponse = UserSchema;
