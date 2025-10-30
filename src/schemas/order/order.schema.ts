import z from "zod";
import { Currency, OrderStatus, PromocodeType } from "@/types/db/db.js";
import { GenericSchema } from "../base.schema.js";

export const AdminOrderSchema = GenericSchema(
	z.object({
		id: z.number(),
		createdAt: z.iso.datetime(),
		updatedAt: z.iso.datetime(),
		userId: z.string(),
		number: z.string(),
		name: z.string(),
		email: z.email(),
		currency: z.enum(Currency),
		total: z.number(),
		phoneNumber: z.string(),
		status: z.enum(OrderStatus),
		billingAddressApartment: z.string(),
		billingAddressCity: z.string(),
		billingAddressHome: z.string(),
		billingAddressStreet: z.string(),
		deliveryAddressApartment: z.string(),
		deliveryAddressCity: z.string(),
		deliveryAddressHome: z.string(),
		deliveryAddressStreet: z.string(),
		preview: z.object({
			imageUrL: z.string(),
			orderItemCount: z.number(),
		}),
	}),
	"promocode",
	z
		.object({
			id: z.number(),
			discountValue: z.string(),
			type: z.enum(PromocodeType),
			code: z.string(),
		})
		.nullable(),
);

export const OrderSchema = AdminOrderSchema.omit({
	id: true,
	updatedAt: true,
	userId: true,
}).extend({
	promocode: AdminOrderSchema.shape.promocode.nullable().transform((promo) => {
		if (!promo) return null;
		const { id, ...rest } = promo;
		return rest;
	}),
});

export const SpecificAdminOrderSchema = GenericSchema(
	z.object({
		number: z.string(),
		name: z.string(),
		createdAt: z.iso.datetime(),
		email: z.email(),
		currency: z.enum(Currency),
		total: z.number(),
		phoneNumber: z.string(),
		status: z.enum(OrderStatus),
		billingAddressApartment: z.string(),
		billingAddressCity: z.string(),
		billingAddressHome: z.string(),
		billingAddressStreet: z.string(),
		deliveryAddressApartment: z.string(),
		deliveryAddressCity: z.string(),
		deliveryAddressHome: z.string(),
		deliveryAddressStreet: z.string(),
		promocode: z
			.object({
				discountValue: z.string(),
				type: z.enum(PromocodeType),
				code: z.string(),
			})
			.nullable(),
	}),
	"orderItems",
	z.array(
		z.object({
			productSkuId: z.number(),
			name: z.string(),
			image: z.string(),
			price: z.number(),
			quantity: z.number(),
		}),
	),
);

export const SpecificOrderSchema = SpecificAdminOrderSchema.omit({
	orderItems: true,
}).extend({
	paymentTimeoutInMinutes: z.number(),
	orderItems: z.array(
		z.object({
			name: z.string(),
			image: z.string(),
			price: z.number(),
			quantity: z.number(),
		}),
	),
});