import z from "zod";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "@/const/zod.js";

export const ResetPasswordRequestSchema = z.object({
	token: z.string(),
	newPassword: z
		.string()
		.min(SignUpPasswordMinLength)
		.max(SignUpPasswordMaxLength),
});
export const ResetPasswordResponseSchema = z.string();

export type ResetPasswordRequest = z.Infer<typeof ResetPasswordRequestSchema>;