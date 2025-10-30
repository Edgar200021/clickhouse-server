import {randomUUID} from "node:crypto";
import path from "node:path";
import type {UploadApiOptions} from "cloudinary";
import type {FastifyInstance} from "fastify/types/instance.js";
import fp from "fastify-plugin";
import type {FileUploadResponse} from "@/types/cloudinary.js";

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

	async function upload(
		file: Buffer | File,
		options?: UploadApiOptions,
	): Promise<FileUploadResponse> {
		const f =
			file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;

		return new Promise((res, rej) => {
			const publicId = randomUUID().toString();

			fastify.cloudinary.uploader
				.upload_stream(
					{
						...options,
						...baseOptions,
						...(file instanceof File
							? {
								filename_override: file.name,
								format: path.extname(file.name).slice(1),
								resource_type: file.type.startsWith("video")
									? "video"
									: [
										"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
										"text/plain",
										"application/zip",
										"application/vnd.ms-powerpoint",
										"application/vnd.ms-excel",
										"application/msword",
									].includes(file.type)
										? "raw"
										: "auto",
							}
							: {}),
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
				.end(f);
		});
	}

	async function deleteFile(fileId: FileUploadResponse["fileId"]) {
		await fastify.cloudinary.uploader.destroy(fileId);
	}

	return {upload, deleteFile};
}

export default fp(
	async (fastify) => {
		fastify.decorate("fileUploaderManager", createFileUploaderManager(fastify));
	},
	{
		dependencies: ["cloudinary"],
		name: "fileUploaderManager"
	},
);