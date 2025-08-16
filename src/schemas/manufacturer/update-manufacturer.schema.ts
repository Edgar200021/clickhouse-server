import z from "zod";
import { ManufacturerNameMaxLength } from "../../const/zod.js";
import { ManufacturerSchema } from "./manufacturer.schema.js";

export const UpdateManufacturerRequestSchema = z.object({
	name: z.string().nonempty().max(ManufacturerNameMaxLength),
});

export const UpdateManufacturerResponseSchema = ManufacturerSchema;

export type UpdateManufacturerRequest = z.Infer<
	typeof UpdateManufacturerRequestSchema
>;
