import { exec } from "node:child_process";
import type { FastifyBaseLogger } from "fastify";
import type { FastifyInstance } from "fastify/types/instance.js";
import type { CreateManufacturerRequest } from "../schemas/manufacturer/create-manufacturer.schema.js";
import {
	type ManufacturerParam,
	ManufacturerParamSchema,
} from "../schemas/manufacturer/manufacturer-param.schema.js";
import type { UpdateManufacturerRequest } from "../schemas/manufacturer/update-manufacturer.schema.js";
import type { Manufacturer } from "../types/db/manufacturer.js";
import { isDatabaseError } from "../types/db/error.js";
import { DuplicateCode } from "../const/database.js";

export function createManufacturerService(instance: FastifyInstance) {
	const { kysely, httpErrors } = instance;

	async function getManufacturers(): Promise<Manufacturer[]> {
		const manufacturers = await kysely
			.selectFrom("manufacturer")
			.selectAll()
			.execute();

		return manufacturers;
	}

	async function getManufacturer(
		param: ManufacturerParam,
		log: FastifyBaseLogger,
	): Promise<Manufacturer> {
		const manufacturer = await kysely
			.selectFrom("manufacturer")
			.selectAll()
			.where("id", "=", param.manufacturerId)
			.executeTakeFirst();

		if (!manufacturer) {
			log.info("Get manufacturer failed: manufacturer doesn't exist");
			throw httpErrors.notFound("Manufacturer doesn't exist");
		}

		return manufacturer;
	}

	async function createManufacturer(
		data: CreateManufacturerRequest,
		log: FastifyBaseLogger,
	): Promise<Manufacturer> {
		try {
			const newManufacturer = await kysely
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
				throw httpErrors.badRequest("Manufacturer already exists");
			}

			throw err;
		}
	}

	async function updateManufacturer(
		data: UpdateManufacturerRequest,
		param: ManufacturerParam,
		log: FastifyBaseLogger,
	): Promise<Manufacturer> {
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

	async function deleteManufacturer(
		param: ManufacturerParam,
		log: FastifyBaseLogger,
	) {
		const manufacturer = await kysely
			.selectFrom("manufacturer")
			.where("id", "=", param.manufacturerId)
			.select(["id"])
			.executeTakeFirst();

		if (!manufacturer) {
			log.info("Delete manufacturer failed: manufacturer doesn't exist");
			throw httpErrors.notFound("Manufacturer doesn't exist");
		}

		if (manufacturer.id === 1) {
			log.info("Delete manufacturer failed: can't delete default manufacturer");
			throw httpErrors.badRequest("Can't delete default manufacturer");
		}

		await kysely
			.deleteFrom("manufacturer")
			.where("id", "=", param.manufacturerId)
			.execute();
	}

	return {
		getManufacturers,
		getManufacturer,
		createManufacturer,
		updateManufacturer,
		deleteManufacturer,
	};
}
