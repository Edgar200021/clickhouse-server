import z from "zod";
import { ManufacturerNameMaxLength } from "../../const/zod.js";
import { ManufacturerSchema } from "./manufacturer.schema.js";

export const CreateManufacturerRequestSchema = z.object({
	name: z.string().nonempty().max(ManufacturerNameMaxLength),
});

export const CreateManufacturerResponseSchema = ManufacturerSchema;

export type CreateManufacturerRequest = z.Infer<
	typeof CreateManufacturerRequestSchema
>;
