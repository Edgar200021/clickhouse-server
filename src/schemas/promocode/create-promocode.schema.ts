import { constructNow } from "date-fns";
import z from "zod";
import { PromocodeType } from "@/types/db/db.js";
import { PromocodeAdminSchema } from "./promocode.schema.js";

export const CreatePromocodeRequestSchema = z
	.object({
		code: z.string().trim().nonempty(),
		type: z.enum(PromocodeType),
		discountValue: z.float32().positive(),
		usageLimit: z.number().positive(),
		validFrom: z.iso.datetime(),
		validTo: z.iso.datetime(),
	})
	.refine(
		(obj) => {
			if (obj.type === PromocodeType.Percent) return obj.discountValue < 100;

			return true;
		},
		{
			error: "Discount value must be less than 100 for percent promocodes",
			path: ["discountValue"],
		},
	)
	.refine(
		(obj) =>
			new Date(obj.validTo).getTime() > new Date(obj.validFrom).getTime(),
		{
			error: "Valid to must be greater than valid from",
			path: ["validTo"],
		},
	)
	.refine(
		(obj) =>
			new Date(obj.validTo).getTime() > constructNow(undefined).getTime(),
		{
			error: "Valid to must be greater than current date",
			path: ["validTo"],
		},
	);

export const CreatePromocodeResponseSchema = PromocodeAdminSchema;

export type CreatePromocodeRequest = z.infer<
	typeof CreatePromocodeRequestSchema
>;