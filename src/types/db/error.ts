export type DatabaseError = {
	table: string;
	code: string;
	detail: string;
};

export const isDatabaseError = (err: unknown): err is DatabaseError => {
	return (
		(err as DatabaseError).code !== undefined &&
		(err as DatabaseError).table !== undefined &&
		(err as DatabaseError).detail !== undefined
	);
};
