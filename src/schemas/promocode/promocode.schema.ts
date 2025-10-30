import z from "zod";
import { PromocodeType } from "@/types/db/db.js";

export const PromocodeAdminSchema = z.object({
	id: z.number().positive(),
	code: z.string().trim().nonempty(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	discountValue: z.string().trim().nonempty(),
	type: z.enum(PromocodeType),
	usageCount: z.number().gte(0),
	usageLimit: z.number().positive(),
	validFrom: z.iso.datetime(),
	validTo: z.iso.datetime(),
});

export const PromocodeSchema = PromocodeAdminSchema.pick({
	code: true,
	type: true,
	discountValue: true,
	validTo: true,
});