import z from "zod";

export const ManufacturerParamSchema = z.object({
	manufacturerId: z.coerce.number().positive(),
});

export type ManufacturerParam = z.Infer<typeof ManufacturerParamSchema>;
