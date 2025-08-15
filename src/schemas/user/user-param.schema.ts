import z from "zod";

export const UserParamSchema = z.object({
	userId: z.uuid(),
});

export type UserParam = z.Infer<typeof UserParamSchema>;
