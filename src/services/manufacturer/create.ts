import {CreateManufacturerRequest} from "@/schemas/manufacturer/create-manufacturer.schema.js";
import {FastifyBaseLogger} from "fastify";
import {type ManufacturerService} from "@/services/manufacturer/manufacturer.service.js";
import {Manufacturer} from "@/types/db/manufacturer.js";
import {isDatabaseError} from "@/types/db/error.js";
import {DuplicateCode} from "@/const/database.js";

export async function create(
	this: ManufacturerService,
	data: CreateManufacturerRequest,
	log: FastifyBaseLogger,
): Promise<Manufacturer> {
	try {
		const newManufacturer = await this.fastify.kysely
			.insertInto("manufacturer")
			.values({
				name: data.name,
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		return newManufacturer;
	} catch (err) {
		if (isDatabaseError(err) && err.code === DuplicateCode) {
			log.info("Create manufacturer failed: manufacturer already exists");
			throw this.fastify.httpErrors.badRequest("Manufacturer already exists");
		}

		throw err;
	}
}