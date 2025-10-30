import type {PromocodeParam} from "@/schemas/promocode/promocode-param.schema.js";
import type {FastifyBaseLogger} from "fastify";
import {type PromocodeService} from "@/services/promocode/promocode.service.js";

export async function remove(this: PromocodeService, param: PromocodeParam, log: FastifyBaseLogger) {
	const {kysely, httpErrors} = this.fastify

	const promocode = await kysely
		.deleteFrom("promocode")
		.returning(["id"])
		.where("id", "=", param.promocodeId)
		.executeTakeFirst();

	if (!promocode) {
		log.info({promocodeId: param.promocodeId}, "Promocode doesn't exist");
		throw httpErrors.notFound("Promocode doesn't exist");
	}
}