import { randomUUID } from "node:crypto";
import type { MultipartFile } from "@fastify/multipart";
import type { UploadApiOptions } from "cloudinary";
import type { FastifyInstance } from "fastify/types/instance.js";
import fp from "fastify-plugin";
import type { FileUploadResponse } from "../../types/cloudinary.js";

declare module "fastify" {
	export interface FastifyInstance {
		fileUploaderManager: ReturnType<typeof createFileUploaderManager>;
	}
}

function createFileUploaderManager(fastify: FastifyInstance) {
	const baseOptions: Partial<UploadApiOptions> = {
		folder: fastify.config.cloudinary.uploadFolder,
		use_filename: true,
	};

	async function uploadFromBuffer(
		file: Buffer,
		options?: UploadApiOptions,
	): Promise<FileUploadResponse> {
		return new Promise((res, rej) => {
			const publicId = randomUUID().toString();

			fastify.cloudinary.uploader
				.upload_stream(
					{
						...options,
						...baseOptions,
						public_id: publicId,
					},
					(err, result) => {
						if (err || !result) {
							return rej(err ?? new Error("Failed to upload file"));
						}

						return res({
							fileUrl: result.secure_url,
							fileId: result.public_id,
							fileName: result.original_filename,
						});
					},
				)
				.end(file);
		});
	}

	async function deleteFile(fileId: FileUploadResponse["fileId"]) {
		await fastify.cloudinary.uploader.destroy(fileId);
	}

	return { uploadFromBuffer, deleteFile };
}

export default fp(
	async (fastify) => {
		fastify.decorate("fileUploaderManager", createFileUploaderManager(fastify));
	},
	{
		dependencies: ["cloudinary"],
	},
);
