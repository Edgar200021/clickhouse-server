import { Type } from "@sinclair/typebox";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "../../const/type-box.js";

export const ResetPasswordSchemaRequest = Type.Object({
	token: Type.String(),
	newPassword: Type.String({
		minLength: SignUpPasswordMinLength,
		maxLength: SignUpPasswordMaxLength,
	}),
});
export const ResetPasswordSchemaResponse = Type.String();
