import z from "zod";

export const SuccessResponseSchema = <T extends z.ZodTypeAny>(data: T) =>
	z.object({
		status: z.literal("success"),
		data,
	});

export const ErrorResponseSchema = z.object({
	status: z.literal("error"),
	error: z.string(),
});

export const ValidationErrorResponseSchema = z.object({
	status: z.literal("error"),
	errors: z.record(z.string(), z.string()),
});

export const WithCountSchema = <T extends z.ZodTypeAny>(key: string, data: T) =>
	z.object({
		totalCount: z.number().gte(0),
		[key]: data,
	});
