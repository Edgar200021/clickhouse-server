import type {UpdateProductRequest} from "@/schemas/product/update-product.schema.js";
import type {ProductParam} from "@/schemas/product/product-param.schema.js";
import type {FastifyBaseLogger} from "fastify";
import type {Product} from "@/types/db/product.js";
import {isDatabaseError} from "@/types/db/error.js";
import {ForeignKeyConstraintCode} from "@/const/database.js";
import {type ProductService} from "@/services/product/product.service.js";

export async function update(
	this: ProductService,
	data: UpdateProductRequest,
	param: ProductParam,
	log: FastifyBaseLogger,
): Promise<Product> {
	const {kysely, httpErrors, fileUploaderManager} = this.fastify

	try {
		const product = await kysely
			.selectFrom("product")
			.selectAll()
			.where("id", "=", param.productId)
			.executeTakeFirst();

		if (!product) {
			log.info("Update product failed: product not found");
			throw httpErrors.notFound("Product not found");
		}

		const uploadResult = data.assemblyInstruction
			? await fileUploaderManager.upload(data.assemblyInstruction)
			: null;

		if (uploadResult && product.assemblyInstructionFileId) {
			await fileUploaderManager.deleteFile(product.assemblyInstructionFileId);
		}

		const updateData: Partial<Product> = Object.entries(data)
			.filter(([key]) => key !== "assemblyInstruction")
			.reduce(
				(acc, [key, value]) => {
					const typedKey = key as keyof Product;

					if (product[typedKey] !== value) {
						acc[typedKey] = value;
					}

					return acc;
				},
				{} as Partial<Product>,
			);

		if (uploadResult) {
			updateData.assemblyInstructionFileId = uploadResult.fileId;
			updateData.assemblyInstructionFileUrl = uploadResult.fileUrl;
		}

		if (!Object.keys(updateData).length) return product;

		const updated = await kysely
			.updateTable("product")
			.set(updateData)
			.returningAll()
			.executeTakeFirstOrThrow();

		return updated;
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