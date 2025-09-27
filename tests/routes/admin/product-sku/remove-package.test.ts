import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../../src/const/zod.js";
import type { ProductSkuAttributes } from "../../../../src/schemas/product-sku/product-sku.schema.js";
import { UserRole } from "../../../../src/types/db/db.js";
import type {
	ProductSku,
	ProductSkuImages,
	ProductSkuPackage,
} from "../../../../src/types/db/product.js";
import { buildTestApp, type WithSignIn } from "../../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let productsSkus: (Omit<ProductSku, "attributes" | "productId"> & {
		attributes: ProductSkuAttributes;
		images: Pick<ProductSkuImages, "id" | "imageId" | "imageUrl">[];
		packages: Omit<ProductSkuPackage, "productSkuId">[];
	})[];

	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();

		const res = await testApp.app.kysely
			.selectFrom("productSku")
			.innerJoin("product", "product.id", "productSku.productId")
			.select([
				"productSku.id",
				"productSku.createdAt",
				"productSku.updatedAt",
				"productSku.currency",
				"productSku.price",
				"productSku.salePrice",
				"productSku.quantity",
				"productSku.sku",
			])
			.select(
				sql<ProductSkuAttributes>`hstore_to_json(product_sku.attributes)`.as(
					"attributes",
				),
			)
			.select((eb) =>
				eb
					.selectFrom("productSkuImages")
					.select(
						sql<Pick<ProductSkuImages, "id" | "imageId" | "imageUrl">[]>`
			COALESCE(
			  json_agg(
			    json_build_object(
						'id', product_sku_images.id,
			      'imageId', product_sku_images.image_id,
			      'imageUrl', product_sku_images.image_url
			    )
			  ),
			  '[]'::json
			)
			   `.as("images"),
					)
					.whereRef("productSkuImages.productSkuId", "=", "productSku.id")
					.as("images"),
			)
			.select((eb) =>
				eb
					.selectFrom("productSkuPackage")
					.select(
						sql<Omit<ProductSkuPackage, "productSkuId">[]>`
			     COALESCE(
			       json_agg(
			         json_build_object(
			           'id', product_sku_package.id,
			           'createdAt', product_sku_package.created_at,
			           'updatedAt', product_sku_package.updated_at,
			           'length', product_sku_package.length,
			           'quantity', product_sku_package.quantity,
			           'width', product_sku_package.width,
			           'height', product_sku_package.height,
			           'weight', product_sku_package.weight
			         )
			       ),
			       '[]'::json
			     )
			   `.as("packages"),
					)
					.whereRef("productSkuPackage.productSkuId", "=", "productSku.id")
					.as("packages"),
			)
			.execute();

		//@ts-expect-error...
		productsSkus = res;
	});

	afterEach(async () => await testApp.close());

	describe("Remove Product Sku Package", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const removeProductSkuPackageRes = await testApp.withSignIn<
				Parameters<typeof testApp.removeProductSkuPackage>["1"][],
				WithSignIn<Parameters<typeof testApp.removeProductSkuPackage>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.removeProductSkuPackage,
					additionalArg: [
						{
							productSkuId: productsSkus[0].id,
							packageId: productsSkus[0].packages[0].id,
						},
					],
				},
				UserRole.Admin,
			);
			expect(removeProductSkuPackageRes.statusCode).toBe(200);
		});

		it("Should be deleted from database when request is successfull", async () => {
			const removeProductSkuPackageRes = await testApp.withSignIn<
				Parameters<typeof testApp.removeProductSkuPackage>["1"][],
				WithSignIn<Parameters<typeof testApp.removeProductSkuPackage>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.removeProductSkuPackage,
					additionalArg: [
						{
							productSkuId: productsSkus[0].id,
							packageId: productsSkus[0].packages[0].id,
						},
					],
				},
				UserRole.Admin,
			);

			expect(removeProductSkuPackageRes.statusCode).toBe(200);

			const dbPackage = await testApp.app.kysely
				.selectFrom("productSkuPackage")
				.where("productSkuId", "=", productsSkus[0].id)
				.where("id", "=", productsSkus[0].packages[0].id)
				.executeTakeFirst();

			expect(dbPackage).toBeUndefined();
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					name: "Invalid product sku id type",
					data: {
						productSkuId: "someid",
						packageId: productsSkus[0].packages[0].id,
					},
				},
				{
					name: "Invalid package id type",
					data: {
						productSkuId: productsSkus[0].id,
						packageId: "someid",
					},
				},
			];

			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.removeProductSkuPackage>["1"][],
				WithSignIn<Parameters<typeof testApp.removeProductSkuPackage>["1"][]>[]
			>(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.removeProductSkuPackage,
					additionalArg: [t] as unknown as Parameters<
						typeof testApp.removeProductSkuPackage
					>["1"][],
				})),
				UserRole.Admin,
			);

			for (const response of responses as unknown as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(400);
			}
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const removeProductSkuPackageRes = await testApp.removeProductSkuPackage(
				{},
				{
					productSkuId: productsSkus[0].id,
					packageId: productsSkus[0].packages[0].id,
				},
			);
			expect(removeProductSkuPackageRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const removeProductSkuPackageRes = await testApp.withSignIn<
				Parameters<typeof testApp.removeProductSkuPackage>["1"][],
				WithSignIn<Parameters<typeof testApp.removeProductSkuPackage>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.removeProductSkuPackage,
					additionalArg: [
						{
							productSkuId: productsSkus[0].id,
							packageId: productsSkus[0].packages[0].id,
						},
					],
				},
			);
			expect(removeProductSkuPackageRes.statusCode).toBe(403);
		});

		it("Should return 404 status code when product or package doesn't exists", async () => {
			const testCases = [
				{
					productSkuId: Math.max(...productsSkus.map((p) => p.id)) + 1,
					packageId: productsSkus[0].packages[0].id,
				},
				{
					productSkuId: productsSkus[0].id,
					packageId: Math.max(...productsSkus[0].packages.map((i) => i.id)) + 1,
				},
			];

			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.removeProductSkuPackage>["1"][],
				WithSignIn<Parameters<typeof testApp.removeProductSkuPackage>["1"][]>[]
			>(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.removeProductSkuPackage,
					additionalArg: [
						{
							productSkuId: t.productSkuId,
							packageId: t.packageId,
						},
					],
				})),
				UserRole.Admin,
			);

			for (const response of responses as unknown as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(404);
			}
		});
	});
});
