import { Static, Type } from "@sinclair/typebox";

export const ForgotPasswordRequestSchema = Type.Object({
	email: Type.String({ format: "email" }),
});
export const ForgotPasswordResponseSchema = Type.String();

export type FrogotPasswordRequest = Static<typeof ForgotPasswordRequestSchema>;
