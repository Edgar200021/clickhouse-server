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

	describe("Remove Product Sku Image", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const removeProductSkuRes = await testApp.withSignIn<
				Parameters<typeof testApp.removeProductSkuImage>["1"][],
				WithSignIn<Parameters<typeof testApp.removeProductSkuImage>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.removeProductSkuImage,
					additionalArg: [
						{
							productSkuId: productsSkus[0].id,
							imageId: productsSkus[0].images[0].id,
						},
					],
				},
				UserRole.Admin,
			);

			expect(removeProductSkuRes.statusCode).toBe(200);
		});

		it("Should be deleted from database when request is successfull", async () => {
			const removeProductSkuRes = await testApp.withSignIn<
				Parameters<typeof testApp.removeProductSkuImage>["1"][],
				WithSignIn<Parameters<typeof testApp.removeProductSkuImage>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.removeProductSkuImage,
					additionalArg: [
						{
							productSkuId: productsSkus[0].id,
							imageId: productsSkus[0].images[0].id,
						},
					],
				},
				UserRole.Admin,
			);

			expect(removeProductSkuRes.statusCode).toBe(200);

			const dbImage = await testApp.app.kysely
				.selectFrom("productSkuImages")
				.where("productSkuId", "=", productsSkus[0].id)
				.where("id", "=", productsSkus[0].images[0].id)
				.executeTakeFirst();

			expect(dbImage).toBeUndefined();
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					name: "Invalid product sku id type",
					data: {
						productSkuId: "someid",
						imageId: productsSkus[0].images[0].id,
					},
				},
				{
					name: "Invalid image id type",
					data: {
						productSkuId: productsSkus[0].id,
						imageId: "someid",
					},
				},
			];

			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.removeProductSkuImage>["1"][],
				WithSignIn<Parameters<typeof testApp.removeProductSkuImage>["1"][]>[]
			>(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.removeProductSkuImage,
					additionalArg: [t] as unknown as Parameters<
						typeof testApp.removeProductSkuImage
					>["1"][],
				})),
				UserRole.Admin,
			);

			for (const response of responses as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(400);
			}
		});

		it("Should return 400 status code when product sku has only 1 image", async () => {
			for (const [index, val] of productsSkus[0].images.entries()) {
				const removeProductSkuRes = await testApp.withSignIn<
					Parameters<typeof testApp.removeProductSkuImage>["1"][],
					WithSignIn<Parameters<typeof testApp.removeProductSkuImage>["1"][]>
				>(
					{
						body: {
							email: faker.internet.email(),
							password: faker.internet.password({
								length: SignUpPasswordMinLength,
							}),
						},
					},
					{
						fn: testApp.removeProductSkuImage,
						additionalArg: [
							{
								productSkuId: productsSkus[0].id,
								imageId: val.id,
							},
						],
					},
					UserRole.Admin,
				);

				expect(removeProductSkuRes.statusCode).toBe(
					index === productsSkus[0].images.length - 1 ? 400 : 200,
				);
			}
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const removeProductSkuRes = await testApp.removeProductSkuImage(
				{},
				{
					productSkuId: productsSkus[0].id,
					imageId: productsSkus[0].images[0].id,
				},
			);
			expect(removeProductSkuRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const removeProductSkuRes = await testApp.withSignIn<
				Parameters<typeof testApp.removeProductSkuImage>["1"][],
				WithSignIn<Parameters<typeof testApp.removeProductSkuImage>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.removeProductSkuImage,
					additionalArg: [
						{
							productSkuId: productsSkus[0].id,
							imageId: productsSkus[0].images[0].id,
						},
					],
				},
			);
			expect(removeProductSkuRes.statusCode).toBe(403);
		});

		it("Should return 404 status code when product or image doesn't exists", async () => {
			const testCases = [
				{
					productSkuId: Math.max(...productsSkus.map((p) => p.id)) + 1,
					imageId: productsSkus[0].images[0].id,
				},
				{
					productSkuId: productsSkus[0].id,
					imageId: Math.max(...productsSkus[0].images.map((i) => i.id)) + 1,
				},
			];

			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.removeProductSkuImage>["1"][],
				WithSignIn<Parameters<typeof testApp.removeProductSkuImage>["1"][]>[]
			>(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.removeProductSkuImage,
					additionalArg: [
						{
							productSkuId: t.productSkuId,
							imageId: t.imageId,
						},
					],
				})),
				UserRole.Admin,
			);

			for (const response of responses as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(404);
			}
		});
	});
});
