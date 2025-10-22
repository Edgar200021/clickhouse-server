import z from "zod";

export const CapturePaymentRequestSchema = z.object({
	sessionId: z.string().trim().nonempty(),
});
export const CapturePaymentResponseSchema = z.null();

export type CapturePaymentRequest = z.infer<typeof CapturePaymentRequestSchema>;
