import { Type } from "@sinclair/typebox";

export const ForgotPasswordSchemaRequest = Type.Object({
	email: Type.String({ format: "email" }),
});
export const ForgotPasswordSchemaResponse = Type.String();
