export type Nullable<T> = null | T;
export type WithPageCount<T, K extends string> = {
	pageCount: number;
} & Record<K, T>;

export type Combined<
	O extends Record<string, unknown>,
	T,
	K extends string,
	NullableField extends boolean = false,
> = {
	[key in keyof O]: O[key];
} & (NullableField extends true ? Record<K, Nullable<T>> : Record<K, T>);
