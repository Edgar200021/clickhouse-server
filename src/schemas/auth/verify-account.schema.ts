import { Static, Type } from "@sinclair/typebox";

export const VerifyAccountRequestSchema = Type.Object({
	token: Type.String(),
});
export const VerifyAccountResponseSchema = Type.String();

export type VerifyAccountRequest = Static<typeof VerifyAccountRequestSchema>;
