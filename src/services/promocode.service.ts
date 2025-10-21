import { constructNow, isAfter, isBefore, isEqual } from "date-fns";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import {
	type Expression,
	type ExpressionBuilder,
	type ExpressionWrapper,
	type SqlBool,
	sql,
} from "kysely";
import { DuplicateCode } from "../const/database.js";
import type { CreatePromocodeRequest } from "../schemas/promocode/create-promocode.schema.js";
import type { GetPromocodesRequestQuery } from "../schemas/promocode/get-promocodes.schema.js";
import type { PromocodeParam } from "../schemas/promocode/promocode-param.schema.js";
import type { UpdatePromocodeRequest } from "../schemas/promocode/update-promocode.schema.js";
import type { WithPageCount } from "../types/base.js";
import { type DB, PromocodeType } from "../types/db/db.js";
import { isDatabaseError } from "../types/db/error.js";
import type { Promocode } from "../types/db/promocode.js";

export function createPromocodeService(instance: FastifyInstance) {
	const { kysely, httpErrors } = instance;

	async function getAll(
		query: GetPromocodesRequestQuery,
	): Promise<WithPageCount<Promocode[], "promocodes">> {
		const promocodes = await kysely
			.selectFrom("promocode")
			.selectAll()
			.where((eb) => buildFilters(query, eb))
			.limit(query.limit)
			.offset(query.limit * query.page - query.limit)
			.orderBy("createdAt", "desc")
			.execute();

		const { totalCount } = await kysely
			.selectFrom("promocode")
			.select(sql<number>`COUNT(*)::INTEGER`.as("totalCount"))
			.where((eb) => buildFilters(query, eb))
			.executeTakeFirstOrThrow();

		return {
			pageCount: Math.ceil(totalCount / query.limit),
			promocodes,
		};
	}

	async function get<T extends boolean>(
		type:
			| {
					type: "code";
					code: Promocode["code"];
			  }
			| {
					type: "id";
					id: Promocode["id"];
			  },
		opts: {
			validate: T;
			onError?: (err: string) => void;
		} = { validate: true as T },
	): Promise<T extends true ? Promocode : Promocode | undefined> {
		const promocode = await kysely
			.selectFrom("promocode")
			.selectAll()
			.where((eb) => {
				if (type.type === "code") {
					return eb("code", "=", type.code);
				}

				return eb("id", "=", type.id);
			})
			.executeTakeFirst();

		if (opts.validate) {
			if (!promocode) {
				opts.onError?.("promocode not found");
				throw httpErrors.notFound("Promocode not found");
			}

			const validationResult = isValid(promocode);
			if (!validationResult.valid) {
				opts.onError?.(validationResult.reason);
				throw httpErrors.badRequest(validationResult.reason);
			}
		}

		return promocode as T extends true ? Promocode : Promocode | undefined;
	}

	async function create(
		data: CreatePromocodeRequest,
		log: FastifyBaseLogger,
	): Promise<Promocode> {
		try {
			const promocode = await kysely
				.insertInto("promocode")
				.values(data)
				.returningAll()
				.executeTakeFirstOrThrow();

			return promocode;
		} catch (error) {
			if (isDatabaseError(error) && error.code === DuplicateCode) {
				log.info({ code: data.code }, "Promocode already exists");
				throw httpErrors.badRequest("Promocode already exists");
			}
			throw error;
		}
	}

	async function update(
		data: UpdatePromocodeRequest,
		param: PromocodeParam,
		log: FastifyBaseLogger,
	): Promise<Promocode> {
		try {
			const promocode = await kysely
				.selectFrom("promocode")
				.selectAll()
				.where("id", "=", param.promocodeId)
				.executeTakeFirst();

			if (!promocode) {
				log.info({ promocodeId: param.promocodeId }, "Promocode doesn't exist");
				throw httpErrors.badRequest("Promocode doesn't exist");
			}

			const updateData = buildUpdateData(data, promocode, log);
			const updated = await kysely
				.updateTable("promocode")
				.set(updateData)
				.where("id", "=", param.promocodeId)
				.returningAll()
				.executeTakeFirstOrThrow();

			return updated;
		} catch (error) {
			if (isDatabaseError(error) && error.code === DuplicateCode) {
				log.info({ code: data.code }, "Promocode already exists");
				throw httpErrors.badRequest("Promocode already exists");
			}
			throw error;
		}
	}

	async function remove(param: PromocodeParam, log: FastifyBaseLogger) {
		const promocode = await kysely
			.deleteFrom("promocode")
			.returning(["id"])
			.where("id", "=", param.promocodeId)
			.executeTakeFirst();

		if (!promocode) {
			log.info({ promocodeId: param.promocodeId }, "Promocode doesn't exist");
			throw httpErrors.notFound("Promocode doesn't exist");
		}
	}

	function isValid(
		promocode: Promocode,
	): { valid: true } | { valid: false; reason: string } {
		const now = constructNow(undefined);

		if (isBefore(now, promocode.validFrom))
			return { valid: false, reason: "Promocode not active yet" };
		if (isAfter(now, promocode.validTo))
			return { valid: false, reason: "Promocode expired" };
		if (promocode.usageCount >= promocode.usageLimit)
			return { valid: false, reason: "Promocode is inactive" };
		return { valid: true };
	}

	function buildUpdateData(
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
			throw httpErrors.badRequest("No changes detected");
		}

		if (
			!updateData.type &&
			updateData.discountValue &&
			promocode.type === PromocodeType.Percent &&
			Number(updateData.discountValue) >= 100
		) {
			log.info("Discount value must be less than 100% for percent promocodes");
			throw httpErrors.badRequest(
				"Discount value must be less than 100% for percent promocodes",
			);
		}

		if (
			updateData.validTo &&
			!updateData.validFrom &&
			isBefore(updateData.validTo, promocode.validFrom)
		) {
			log.info(
				{ validFrom: promocode.validFrom, validTo: updateData.validTo },
				"ValidTo is before ValidFrom",
			);
			throw httpErrors.badRequest(
				"ValidTo date cannot be before current ValidFrom date",
			);
		}

		if (
			updateData.validFrom &&
			!updateData.validTo &&
			isAfter(updateData.validFrom, promocode.validTo)
		) {
			log.info(
				{ validFrom: updateData.validFrom, validTo: promocode.validTo },
				"ValidFrom is after ValidTo",
			);
			throw httpErrors.badRequest(
				"ValidFrom date cannot be after current ValidTo date",
			);
		}

		return updateData;
	}

	function buildFilters(
		query: GetPromocodesRequestQuery,
		eb: ExpressionBuilder<DB, "promocode">,
	): ExpressionWrapper<DB, "promocode", SqlBool> {
		const ands: Expression<SqlBool>[] = [];

		if (query.search) {
			ands.push(eb("code", "ilike", `%${query.search}%`));
		}

		return eb.and(ands);
	}

	return {
		getAll,
		get,
		create,
		update,
		remove,
		isValid,
	};
}
