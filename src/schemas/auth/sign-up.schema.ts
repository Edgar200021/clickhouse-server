import z from "zod";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "../../const/zod.js";

export const SignUpRequestSchema = z.object({
	email: z
		.email()
		.trim()
		.transform((v) => v.toLowerCase()),
	password: z
		.string()
		.min(SignUpPasswordMinLength)
		.max(SignUpPasswordMaxLength),
});
export const SignUpResponseSchema = z.string();

export type SignUpRequest = z.Infer<typeof SignUpRequestSchema>;
