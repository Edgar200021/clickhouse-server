import { readFile } from "node:fs/promises";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupConfig } from "../../src/config.js";
import fileUploaderPlugin from "../../src/plugins/app/file-uploader-manager.js";
import cloudinaryPlugin, {
	autoConfig,
} from "../../src/plugins/external/cloudinary.js";
import { ImagePath } from "../testApp.js";

describe("Plugins", () => {
	let app: FastifyInstance;

	const getFiles = async (): Promise<{
		resources: { asset_id: string; public_id: string }[];
	}> => {
		return new Promise((res, rej) => {
			app.cloudinary.api.resources(
				{
					type: "upload",
					prefix: app.config.cloudinary.uploadFolder,
				},
				(err, result) => {
					if (err) {
						rej(err);
					}

					res(result);
				},
			);
		});
	};

	beforeEach(async () => {
		app = Fastify();

		app.decorate("config", setupConfig());
		await app.register(cloudinaryPlugin, autoConfig);
		await app.register(fileUploaderPlugin);
	});

	afterEach(async () => {
		await app.cloudinary.api.delete_all_resources();
		await app.close();
	});

	describe("File Uploader Manager", () => {
		it("Should upload file", async () => {
			const file = await readFile(ImagePath);
			const res = await app.fileUploaderManager.uploadFromBuffer(file);

			expect(res.fileId).toBeDefined;
			expect(res.fileName).toBeDefined;
			expect(res.fileUrl).toBeDefined;
		});

		it("Should delete file", async () => {
			const file = await readFile(ImagePath);
			const res = await app.fileUploaderManager.uploadFromBuffer(file);

			await app.fileUploaderManager.deleteFile(res.fileId);

			const files = await getFiles();

			expect(files.resources.length).toEqual(0);
		});
	});
});
