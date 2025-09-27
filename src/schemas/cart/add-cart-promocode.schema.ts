import z from "zod";
import { PromocodeSchema } from "../promocode/promocode.schema.js";

export const AddCartPromocodeRequestSchema = z.object({
	promocode: z.string().trim().nonempty(),
});

export const AddCartPromocodeResponseSchema = PromocodeSchema;

export type AddCartPromocodeRequest = z.Infer<
	typeof AddCartPromocodeRequestSchema
>;
