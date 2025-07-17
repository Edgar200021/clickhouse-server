import { Type } from "@sinclair/typebox";

export const VerifyAccountSchemaRequest = Type.Object({
	token: Type.String(),
});
export const VerifyAccountSchemaResponse = Type.String();
