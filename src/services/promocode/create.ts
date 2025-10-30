import {CreatePromocodeRequest} from "@/schemas/promocode/create-promocode.schema.js";
import {FastifyBaseLogger} from "fastify";
import {Promocode} from "@/types/db/promocode.js";
import {type PromocodeService} from "@/services/promocode/promocode.service.js";
import {isDatabaseError} from "@/types/db/error.js";
import {DuplicateCode} from "@/const/database.js";

export async function create(
	this: PromocodeService,
	data: CreatePromocodeRequest,
	log: FastifyBaseLogger,
): Promise<Promocode> {
	const {kysely, httpErrors} = this.fastify

	try {
		const promocode = await kysely
			.insertInto("promocode")
			.values(data)
			.returningAll()
			.executeTakeFirstOrThrow();

		return promocode;
	} catch (error) {
		if (isDatabaseError(error) && error.code === DuplicateCode) {
			log.info({code: data.code}, "Promocode already exists");
			throw httpErrors.badRequest("Promocode already exists");
		}
		throw error;
	}
}