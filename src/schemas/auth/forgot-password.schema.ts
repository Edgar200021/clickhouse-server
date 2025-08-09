import z from "zod";

export const ForgotPasswordRequestSchema = z.object({
	email: z.email(),
});
export const ForgotPasswordResponseSchema = z.null();

export type ForgotPasswordRequest = z.Infer<typeof ForgotPasswordRequestSchema>;
