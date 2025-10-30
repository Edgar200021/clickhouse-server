import {Manufacturer} from "@/types/db/manufacturer.js";
import {type ManufacturerService} from "@/services/manufacturer/manufacturer.service.js";

export async function getAll(this: ManufacturerService): Promise<Manufacturer[]> {
	const manufacturers = await this.fastify.kysely
		.selectFrom("manufacturer")
		.selectAll()
		.execute();

	return manufacturers;
}