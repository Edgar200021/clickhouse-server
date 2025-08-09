import z from "zod";

export const VerifyAccountRequestSchema = z.object({
	token: z.string(),
});
export const VerifyAccountResponseSchema = z.string();

export type VerifyAccountRequest = z.Infer<typeof VerifyAccountRequestSchema>;
