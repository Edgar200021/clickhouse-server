import { type ObjectOptions, type TSchema, Type } from "@sinclair/typebox";

export const SuccessResponseSchema = <T extends TSchema>(
	T: T,
	options?: ObjectOptions,
) =>
	Type.Object(
		{
			status: Type.Literal("success"),
			data: T,
		},
		options,
	);

export const ErrorResponseSchema = Type.Object({
	status: Type.Literal("error"),
	error: Type.String(),
});

export const ValidationErrorResponseSchema = Type.Object({
	status: Type.Literal("error"),
	errors: Type.Record(Type.String(), Type.Array(Type.String())),
});

export const NullableSchema = <T extends TSchema>(T: T) =>
	Type.Union([Type.Null(), T]);
