import { Type } from "@sinclair/typebox";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "../../const/type-box.js";

export const SignUpSchemaRequest = Type.Object({
	email: Type.String({ format: "email" }),
	password: Type.String({
		minLength: SignUpPasswordMinLength,
		maxLength: SignUpPasswordMaxLength,
	}),
});
export const SignUpSchemaResponse = Type.String();
