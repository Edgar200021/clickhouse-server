import z from "zod";

export const CancelPaymentRequestSchema = z.object({
	sessionId: z.string().trim().nonempty(),
});
export const CancelPaymentResponseSchema = z.null();

export type CancelPaymentRequest = z.infer<typeof CancelPaymentRequestSchema>;