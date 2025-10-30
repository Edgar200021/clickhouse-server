import {type ManufacturerService} from "@/services/manufacturer/manufacturer.service.js";
import {ManufacturerParam} from "@/schemas/manufacturer/manufacturer-param.schema.js";
import {FastifyBaseLogger} from "fastify";

export async function remove(
	this: ManufacturerService,
	param: ManufacturerParam,
	log: FastifyBaseLogger,
) {
	const {kysely, httpErrors} = this.fastify

	const manufacturer = await kysely
		.selectFrom("manufacturer")
		.where("id", "=", param.manufacturerId)
		.select(["id"])
		.executeTakeFirst();

	if (!manufacturer) {
		log.info("Delete manufacturer failed: manufacturer doesn't exist");
		throw httpErrors.notFound("Manufacturer doesn't exist");
	}

	if (manufacturer.id === 1) {
		log.info("Delete manufacturer failed: can't delete default manufacturer");
		throw httpErrors.badRequest("Can't delete default manufacturer");
	}

	await kysely
		.deleteFrom("manufacturer")
		.where("id", "=", param.manufacturerId)
		.execute();
}