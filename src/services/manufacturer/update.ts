import {UpdateManufacturerRequest} from "@/schemas/manufacturer/update-manufacturer.schema.js";
import {type ManufacturerService} from "@/services/manufacturer/manufacturer.service.js";
import {ManufacturerParam} from "@/schemas/manufacturer/manufacturer-param.schema.js";
import {FastifyBaseLogger} from "fastify";
import {Manufacturer} from "@/types/db/manufacturer.js";

export async function update(
	this: ManufacturerService,
	data: UpdateManufacturerRequest,
	param: ManufacturerParam,
	log: FastifyBaseLogger,
): Promise<Manufacturer> {
	const {kysely, httpErrors} = this.fastify

	const manufacturer = await kysely
		.selectFrom("manufacturer")
		.select(["id"])
		.where("name", "=", data.name)
		.executeTakeFirst();

	if (manufacturer) {
		log.info("Update manufacturer failed: manufacturer already exists");
		throw httpErrors.badRequest("Manufacturer already exists");
	}

	const updatedManifacturer = await kysely
		.updateTable("manufacturer")
		.set({
			name: data.name,
		})
		.where("id", "=", param.manufacturerId)
		.returningAll()
		.executeTakeFirst();

	if (!updatedManifacturer) {
		log.info("Update manufacturer failed: manufacturer doesn't exist");
		throw httpErrors.notFound("Manufacturer doesn't exist");
	}

	return updatedManifacturer;
}