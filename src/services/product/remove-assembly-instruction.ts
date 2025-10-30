import {
	RemoveProductAssemblyInstructionRequest
} from "@/schemas/product/remove-product-assembly-instruction.schema.js";
import {ProductParam} from "@/schemas/product/product-param.schema.js";
import {FastifyBaseLogger} from "fastify";
import {type ProductService} from "@/services/product/product.service.js";

export async function removeAssemblyInstruction(
	this: ProductService,
	data: RemoveProductAssemblyInstructionRequest,
	param: ProductParam,
	log: FastifyBaseLogger,
) {
	const {kysely, httpErrors, fileUploaderManager} = this.fastify

	const product = await kysely
		.selectFrom("product")
		.select("id")
		.where("id", "=", param.productId)
		.executeTakeFirst();

	if (!product) {
		log.info("Remove product assembly instruction failed: product not found");
		throw httpErrors.notFound("Product not found");
	}

	await fileUploaderManager.deleteFile(data.fileId);
	await kysely
		.updateTable("product")
		.where((eb) =>
			eb.and([
				eb("id", "=", param.productId),
				eb("assemblyInstructionFileId", "=", data.fileId),
			]),
		)
		.set({
			assemblyInstructionFileId: null,
			assemblyInstructionFileUrl: null,
		})
		.execute();
}