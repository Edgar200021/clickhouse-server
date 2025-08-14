import z from "zod";
import { ManufacturerSchema } from "./manufacturer.schema.js";

export const CreateManufacturerRequestSchema = z.object({
	name: z.string().nonempty(),
});

export const CreateManufacturerResponseSchema = ManufacturerSchema;

export type CreateManufacturerRequest = z.Infer<
	typeof CreateManufacturerRequestSchema
>;
