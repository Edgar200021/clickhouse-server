import { type Static, Type } from "@sinclair/typebox";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "../../const/type-box.js";

export const SignUpRequestSchema = Type.Object({
	email: Type.String({ format: "email" }),
	password: Type.String({
		minLength: SignUpPasswordMinLength,
		maxLength: SignUpPasswordMaxLength,
	}),
});
export const SignUpResponseSchema = Type.String();

export type SignUpRequest = Static<typeof SignUpRequestSchema>;
