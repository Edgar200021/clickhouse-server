import z from "zod";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "@/const/zod.js";
import { UserSchema } from "../user/user.schema.js";

export const SignInRequestSchema = z.object({
	email: z.email(),
	password: z
		.string()
		.min(SignUpPasswordMinLength)
		.max(SignUpPasswordMaxLength),
});
export const SignInResponseSchema = UserSchema;

export type SignInRequest = z.Infer<typeof SignInRequestSchema>;