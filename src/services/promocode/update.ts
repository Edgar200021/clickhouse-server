import type {UpdatePromocodeRequest} from "@/schemas/promocode/update-promocode.schema.js";
import type {PromocodeParam} from "@/schemas/promocode/promocode-param.schema.js";
import type {FastifyBaseLogger} from "fastify";
import type {Promocode} from "@/types/db/promocode.js";
import {isDatabaseError} from "@/types/db/error.js";
import {DuplicateCode} from "@/const/database.js";
import {type PromocodeService} from "@/services/promocode/promocode.service.js";

export async function update(
	this: PromocodeService,
	data: UpdatePromocodeRequest,
	param: PromocodeParam,
	log: FastifyBaseLogger,
): Promise<Promocode> {
	const {kysely, httpErrors} = this.fastify

	try {
		const promocode = await kysely
			.selectFrom("promocode")
			.selectAll()
			.where("id", "=", param.promocodeId)
			.executeTakeFirst();

		if (!promocode) {
			log.info({promocodeId: param.promocodeId}, "Promocode doesn't exist");
			throw httpErrors.badRequest("Promocode doesn't exist");
		}

		const updateData = this.buildUpdateData(data, promocode, log);
		const updated = await kysely
			.updateTable("promocode")
			.set(updateData)
			.where("id", "=", param.promocodeId)
			.returningAll()
			.executeTakeFirstOrThrow();

		return updated;
	} catch (error) {
		if (isDatabaseError(error) && error.code === DuplicateCode) {
			log.info({code: data.code}, "Promocode already exists");
			throw httpErrors.badRequest("Promocode already exists");
		}
		throw error;
	}
}