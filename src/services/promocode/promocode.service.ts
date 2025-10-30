import fp from "fastify-plugin"
import {type FastifyBaseLogger, FastifyInstance} from "fastify";
import {getAll} from "@/services/promocode/get-all.js";
import {get} from "@/services/promocode/get.js";
import {create} from "@/services/promocode/create.js";
import {update} from "@/services/promocode/update.js";
import {remove} from "@/services/promocode/remove.js";
import {isValid} from "@/services/promocode/is-valid.js";


import type {GetPromocodesRequestQuery} from "@/schemas/promocode/get-promocodes.schema.js";
import type {Expression, ExpressionBuilder, ExpressionWrapper, SqlBool, Updateable} from "kysely";
import {DB, PromocodeType} from "@/types/db/db.js";
import type {UpdatePromocodeRequest} from "@/schemas/promocode/update-promocode.schema.js";
import type {Promocode} from "@/types/db/promocode.js";
import {isAfter, isBefore, isEqual} from "date-fns";


declare module "fastify" {
	export interface FastifyInstance {
		promocodeService: PromocodeService
	}
}

export class PromocodeService {
	getAll = getAll
	get = get
	create = create
	update = update
	remove = remove
	isValid = isValid

	constructor(readonly fastify: FastifyInstance) {
		this.buildUpdateData = this.buildUpdateData.bind(this)
		this.buildFilters = this.buildFilters.bind(this)

	}

	buildUpdateData(
		data: UpdatePromocodeRequest,
		promocode: Promocode,
		log: FastifyBaseLogger,
	): Omit<
		Updateable<Promocode>,
		"id" | "createdAt" | "updatedAt" | "usageLimit"
	> {
		const updateData: Omit<
			Updateable<Promocode>,
			"id" | "createdAt" | "updatedAt" | "usageLimit"
		> = Object.entries(data).reduce(
			(acc: Updateable<Promocode>, [key, val]) => {
				const typedKey = key as keyof Promocode;

				if (
					(typedKey === "validFrom" || typedKey === "validTo") &&
					isEqual(promocode[typedKey], val)
				)
					return acc;
				if (promocode[typedKey] === val) return acc;

				acc[typedKey] = val;

				return acc;
			},
			{},
		);

		if (!Object.keys(updateData).length) {
			log.info("No fields to update");
			throw this.fastify.httpErrors.badRequest("No changes detected");
		}

		if (
			!updateData.type &&
			updateData.discountValue &&
			promocode.type === PromocodeType.Percent &&
			Number(updateData.discountValue) >= 100
		) {
			log.info("Discount value must be less than 100% for percent promocodes");
			throw this.fastify.httpErrors.badRequest(
				"Discount value must be less than 100% for percent promocodes",
			);
		}

		if (
			updateData.validTo &&
			!updateData.validFrom &&
			isBefore(updateData.validTo, promocode.validFrom)
		) {
			log.info(
				{validFrom: promocode.validFrom, validTo: updateData.validTo},
				"ValidTo is before ValidFrom",
			);
			throw this.fastify.httpErrors.badRequest(
				"ValidTo date cannot be before current ValidFrom date",
			);
		}

		if (
			updateData.validFrom &&
			!updateData.validTo &&
			isAfter(updateData.validFrom, promocode.validTo)
		) {
			log.info(
				{validFrom: updateData.validFrom, validTo: promocode.validTo},
				"ValidFrom is after ValidTo",
			);
			throw this.fastify.httpErrors.badRequest(
				"ValidFrom date cannot be after current ValidTo date",
			);
		}

		return updateData;
	}


	buildFilters(
		query: GetPromocodesRequestQuery,
		eb: ExpressionBuilder<DB, "promocode">,
	): ExpressionWrapper<DB, "promocode", SqlBool> {
		const ands: Expression<SqlBool>[] = [];

		if (query.search) {
			ands.push(eb("code", "ilike", `%${query.search}%`));
		}

		return eb.and(ands);
	}


}


export default fp(async (fastify: FastifyInstance) => {
	fastify.decorate("promocodeService", new PromocodeService(fastify))
}, {
	name: "promocodeService",
})