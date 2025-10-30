import {randomUUID} from "node:crypto";
import {type Insertable, type Kysely, sql} from "kysely";
import type {DB, ProductSkuImages, ProductSkuPackage,} from "../src/types/db/db.js";

export async function seed(db: Kysely<DB>): Promise<void> {
	const productIds = await db.selectFrom("product").select(["id"]).execute();
	const colors = ["белый", "черный", "коричневый", "серый", "бежевый"];

	for (const [index, {id}] of productIds.entries()) {
		for (const color of colors) {
			const productSkuIds = await db
				.insertInto("productSku")
				.values({
					productId: id,
					price: 10000,
					quantity: index % 2 === 0 ? 20 : 0,
					sku: randomUUID(),
					...(index % 2 === 0 ? {salePrice: 5000} : {}),
					attributes: sql`
              hstore
              (
        array['color','length','height','width'],
        array[
              ${color},
              '20',
              '10',
              '5'
              ]
              )
					`,
				})
				.returning("id")
				.execute();

			for (const {id} of productSkuIds) {
				const packageSizes: Insertable<ProductSkuPackage>[] = [
					{
						productSkuId: id,
						quantity: 1,
						height: 200,
						length: 100,
						width: 50,
						weight: 30,
					},
					{
						productSkuId: id,
						quantity: 1,
						height: 201,
						length: 100,
						width: 50,
						weight: 30,
					},
					{
						productSkuId: id,
						quantity: 1,
						height: 202,
						length: 100,
						width: 50,
						weight: 30,
					},
					{
						productSkuId: id,
						quantity: 1,
						height: 203,
						length: 100,
						width: 50,
						weight: 30,
					},
				];

				const productSkuImages: Insertable<ProductSkuImages>[] = [
					{
						imageUrl:
							"https://res.cloudinary.com/dcnl3z4ll/image/upload/v1754970184/clickhouse-test/fdd88cae-38c3-457f-be2f-145a70180d78.jpg",
						imageId: "clickhouse-test/fdd88cae-38c3-457f-be2f-145a70180d78",
						productSkuId: id,
					},
					{
						imageUrl:
							"https://res.cloudinary.com/dcnl3z4ll/image/upload/v1754970239/clickhouse-test/9b2fb268-1beb-4db0-a244-93c981b462ef.jpg",
						imageId: "clickhouse-test/9b2fb268-1beb-4db0-a244-93c981b462ef",
						productSkuId: id,
					},
					{
						imageUrl:
							"https://res.cloudinary.com/dcnl3z4ll/image/upload/v1754970275/clickhouse-test/aefa3b01-8828-4739-8a29-dc06ad1c9ebd.webp",
						imageId: "clickhouse-test/aefa3b01-8828-4739-8a29-dc06ad1c9ebd",
						productSkuId: id,
					},
					{
						imageUrl:
							"https://res.cloudinary.com/dcnl3z4ll/image/upload/v1754970303/clickhouse-test/79f4cbf4-1823-4b11-a091-5ad6cc515f74.jpg",
						imageId: "clickhouse-test/79f4cbf4-1823-4b11-a091-5ad6cc515f74",
						productSkuId: id,
					},
				];

				await db.insertInto("productSkuPackage").values(packageSizes).execute();
				await db
					.insertInto("productSkuImages")
					.values(productSkuImages)
					.execute();
			}
		}
	}
}