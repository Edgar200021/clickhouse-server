import z from "zod";

export const RemoveProductAssemblyInstructionRequestSchema = z.object({
	fileId: z.string().trim().nonempty(),
});

export type RemoveProductAssemblyInstructionRequest = z.Infer<
	typeof RemoveProductAssemblyInstructionRequestSchema
>;
