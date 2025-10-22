import z from "zod";
import { OrderParamSchema } from "../order/order-param.schema.js";

export const CreatePaymentRequestSchema = OrderParamSchema;
export const CreatePaymentResponseSchema = z.object({
	redirectUrl: z.url().trim().nonempty(),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
