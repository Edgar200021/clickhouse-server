import {CreateProductRequest} from "@/schemas/product/create-product.schema.js";
import {FastifyBaseLogger} from "fastify";
import {Product} from "@/types/db/product.js";
import {type ProductService} from "@/services/product/product.service.js";
import {isDatabaseError} from "@/types/db/error.js";
import {ForeignKeyConstraintCode} from "@/const/database.js";

export async function create(
	this: ProductService,
	data: CreateProductRequest,
	log: FastifyBaseLogger,
): Promise<Product> {
	const {kysely, fileUploaderManager, httpErrors} = this.fastify
	try {
		const uploadResult = data.assemblyInstruction
			? await fileUploaderManager.upload(
				Buffer.from(await data.assemblyInstruction.arrayBuffer()),
			)
			: null;

		const product = await kysely
			.insertInto("product")
			.values({
				name: data.name,
				description: data.description,
				shortDescription: data.shortDescription,
				materialsAndCare: data.materialsAndCare,
				categoryId: data.categoryId,
				manufacturerId: data.manufacturerId,
				...(uploadResult
					? {
						assemblyInstructionFileId: uploadResult.fileId,
						assemblyInstructionFileUrl: uploadResult.fileUrl,
					}
					: {}),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		return product;
	} catch (error) {
		if (isDatabaseError(error) && error.code === ForeignKeyConstraintCode) {
			log.info(
				`Create product failed: ${error.detail.includes("manufacturer_id") ? "Manufacturer doesn't exists" : "Category doesn't exists"}`,
			);
			throw httpErrors.notFound(
				error.detail.includes("manufacturer_id")
					? "Manufacturer doesn't exists"
					: "Category doesn't exists",
			);
		}

		throw error;
	}
}