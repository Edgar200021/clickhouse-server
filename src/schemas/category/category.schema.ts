import { Type } from "@sinclair/typebox";

export const CategorySchema = Type.Object({
	id: Type.Number(),
	name: Type.String(),
	path: Type.String(),
});
