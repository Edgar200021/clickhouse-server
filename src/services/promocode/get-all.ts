import type {GetPromocodesRequestQuery} from "@/schemas/promocode/get-promocodes.schema.js";
import type {WithPageCount} from "@/types/base.js";
import type {Promocode} from "@/types/db/promocode.js";
import {sql} from "kysely";
import {type PromocodeService} from "@/services/promocode/promocode.service.js";

export async function getAll(
	this: PromocodeService,
	query: GetPromocodesRequestQuery,
): Promise<WithPageCount<Promocode[], "promocodes">> {
	const {kysely} = this.fastify

	const promocodes = await kysely
		.selectFrom("promocode")
		.selectAll()
		.where((eb) => this.buildFilters(query, eb))
		.limit(query.limit)
		.offset(query.limit * query.page - query.limit)
		.orderBy("createdAt", "desc")
		.execute();

	const {totalCount} = await kysely
		.selectFrom("promocode")
		.select(sql<number>`COUNT(*)::INTEGER`.as("totalCount"))
		.where((eb) => this.buildFilters(query, eb))
		.executeTakeFirstOrThrow();

	return {
		pageCount: Math.ceil(totalCount / query.limit),
		promocodes,
	};
}