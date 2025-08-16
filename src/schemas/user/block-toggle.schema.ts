import z from "zod";

export const BlockToggleRequestSchema = z.object({
	type: z.enum(["lock", "unlock"]),
});

export type BlockToggleRequest = z.Infer<typeof BlockToggleRequestSchema>;
