import z from "zod";
import { ManufacturerSchema } from "./manufacturer.schema.js";

export const UpdateManufacturerRequestSchema = z.object({
	name: z.string().nonempty(),
});

export const UpdateManufacturerResponseSchema = ManufacturerSchema;

export type UpdateManufacturerRequest = z.Infer<
	typeof UpdateManufacturerRequestSchema
>;
