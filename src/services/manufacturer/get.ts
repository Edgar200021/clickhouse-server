import type {ManufacturerParam} from "@/schemas/manufacturer/manufacturer-param.schema.js";
import type {FastifyBaseLogger} from "fastify";
import type {Manufacturer} from "@/types/db/manufacturer.js";
import {type ManufacturerService} from "@/services/manufacturer/manufacturer.service.js";

export async function get(
	this: ManufacturerService,
	param: ManufacturerParam,
	log: FastifyBaseLogger,
): Promise<Manufacturer> {
	const manufacturer = await this.fastify.kysely
		.selectFrom("manufacturer")
		.selectAll()
		.where("id", "=", param.manufacturerId)
		.executeTakeFirst();

	if (!manufacturer) {
		log.info("Get manufacturer failed: manufacturer doesn't exist");
		throw this.fastify.httpErrors.notFound("Manufacturer doesn't exist");
	}

	return manufacturer;
}