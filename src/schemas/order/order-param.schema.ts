import z from "zod";

export const OrderParamSchema = z.object({
	orderNumber: z.uuid(),
});

export type OrderParam = z.Infer<typeof OrderParamSchema>;
