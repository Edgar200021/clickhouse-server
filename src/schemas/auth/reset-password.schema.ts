import { type Static, Type } from "@sinclair/typebox";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "../../const/type-box.js";

export const ResetPasswordRequestSchema = Type.Object({
	token: Type.String(),
	newPassword: Type.String({
		minLength: SignUpPasswordMinLength,
		maxLength: SignUpPasswordMaxLength,
	}),
});
export const ResetPasswordResponseSchema = Type.String();

export type ResetPasswordRequest = Static<typeof ResetPasswordRequestSchema>;
