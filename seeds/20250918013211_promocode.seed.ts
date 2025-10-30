import {faker} from "@faker-js/faker";
import {constructNow} from "date-fns";
import type {Kysely} from "kysely";
import {type DB, PromocodeType} from "../src/types/db/db.js";

export async function seed(db: Kysely<DB>): Promise<void> {
	let count = 0;

	await db
		.insertInto("promocode")
		.values(
			Array.from({length: 100}).map((_, i) => {
				const type = i % 2 === 0 ? PromocodeType.Fixed : PromocodeType.Percent;

				let validFrom: Date;
				let validTo: Date;

				if (i % 3 === 0) {
					validFrom = constructNow(undefined);
					validTo = faker.date.future({years: 1, refDate: validFrom});
					count++;
				} else if (i % 3 === 1) {
					validFrom = faker.date.soon({days: 10});
					validTo = faker.date.soon({days: 40, refDate: validFrom});
				} else {
					validFrom = faker.date.recent({days: 30});
					validTo = faker.date.recent({days: 1});
				}

				return {
					code: faker.string.uuid(),
					discountValue: faker.number.int({
						min: type === PromocodeType.Percent ? 1 : 5,
						max: type === PromocodeType.Percent ? 50 : 500,
					}),
					type,
					usageLimit: faker.number.int({min: 10, max: 500}),
					validFrom,
					validTo,
				};
			}),
		)
		.execute();

	console.log("\n\n\n\n", count);
}