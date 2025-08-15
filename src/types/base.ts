export type Nullable<T> = null | T;
export type WithCount<T, K extends string> = {
	totalCount: number;
} & Record<K, T>;
