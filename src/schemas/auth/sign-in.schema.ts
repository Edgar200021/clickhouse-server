import { type Static, Type } from "@sinclair/typebox";

import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "../../const/type-box.js";
import { UserSchema } from "../user/user.schema.js";

export const SignInRequestSchema = Type.Object({
	email: Type.String({ format: "email" }),
	password: Type.String({
		minLength: SignUpPasswordMinLength,
		maxLength: SignUpPasswordMaxLength,
	}),
});
export const SignInResponseSchema = UserSchema;

export type SignInRequest = Static<typeof SignInRequestSchema>;
