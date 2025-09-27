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

export const WithPageCountSchema = <T extends z.ZodTypeAny>(
	key: string,
	data: T,
) =>
	z.object({
		pageCount: z.number().gte(0),
		[key]: data,
	});

export const GenericSchema = <
	O extends z.ZodObject,
	K extends string | string[],
	T extends z.ZodTypeAny,
>(
	obj: O,
	key: K,
	data: K extends string[] ? T[] : T,
) => {
	const extended = Array.isArray(key)
		? key.reduce(
				(acc, key, i) => {
					acc[key] = (data as T[])[i];
					return acc;
				},
				{} as Record<string, z.ZodTypeAny>,
			)
		: { [key as string]: data };

	return obj.extend(extended);
};
