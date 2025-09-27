import { constructNow } from "date-fns";
import type z from "zod";
import { PromocodeType } from "../../types/db/db.js";
import { CreatePromocodeRequestSchema } from "./create-promocode.schema.js";
import { PromocodeAdminSchema } from "./promocode.schema.js";

export const UpdatePromocodeRequestSchema =
	CreatePromocodeRequestSchema.partial()
		.refine(
			(obj) => {
				if (obj.type && obj.discountValue && obj.type === PromocodeType.Percent)
					return obj.discountValue < 100;

				return true;
			},
			{
				error: "Discount value must be less than 100 for percent promocodes",
				path: ["discountValue"],
			},
		)
		.refine(
			(obj) =>
				obj.validTo && obj.validFrom
					? new Date(obj.validTo).getTime() > new Date(obj.validFrom).getTime()
					: true,
			{
				error: "Valid to must be greater than valid from",
				path: ["validTo"],
			},
		)
		.refine(
			(obj) =>
				obj.validTo
					? new Date(obj.validTo).getTime() > constructNow(undefined).getTime()
					: true,
			{
				error: "Valid to must be greater than current date",
				path: ["validTo"],
			},
		);

export const UpdatePromocodeResponseSchema = PromocodeAdminSchema;

export type UpdatePromocodeRequest = z.infer<
	typeof UpdatePromocodeRequestSchema
>;
