import z from "zod";

export const ManufacturerSchema = z.object({
	id: z.number().positive(),
	name: z.string(),
});
