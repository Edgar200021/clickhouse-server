import z from "zod";
import {
	CreateOrderApartmentMaxLength,
	CreateOrderCityMaxLength,
	CreateOrderHomeMaxLength,
	CreateOrderNameMaxLength,
	CreateOrderStreetMaxLength,
} from "@/const/zod.js";
import { Currency } from "@/types/db/db.js";
import { OrderParamSchema } from "./order-param.schema.js";

const AddressSchema = z.object({
	city: z.string().trim().nonempty().max(CreateOrderCityMaxLength),
	street: z.string().trim().nonempty().max(CreateOrderStreetMaxLength),
	home: z.string().trim().nonempty().max(CreateOrderHomeMaxLength),
	apartment: z.string().trim().nonempty().max(CreateOrderApartmentMaxLength),
});

export const CreateOrderRequestSchema = z.object({
	currency: z.enum(Currency),
	phoneNumber: z.e164(),
	email: z.email(),
	name: z.string().trim().nonempty().max(CreateOrderNameMaxLength),
	billingAddress: AddressSchema,
	deliveryAddress: AddressSchema,
});

export const CreateOrderResponseSchema = OrderParamSchema;

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;