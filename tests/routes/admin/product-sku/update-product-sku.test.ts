import { createReadStream } from "node:fs";
import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import formAutoContent from "form-auto-content";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import {
	ProductSkuImagesMaxLength,
	ProductSkuPackagesMaxLength,
	SignUpPasswordMinLength,
} from "../../../../src/const/zod.js";
import type { ProductSkuAttributes } from "../../../../src/schemas/product-sku/product-sku.schema.js";
import { UserRole } from "../../../../src/types/db/db.js";
import type {
	ProductSku,
	ProductSkuImages,
	ProductSkuPackage,
} from "../../../../src/types/db/product.js";
import { buildTestApp, ImagePath, type WithSignIn } from "../../../testApp.js";

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

	describe("Update Product Sku", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const updateProductSku = await testApp.withSignIn<
				Parameters<typeof testApp.updateProductSku>["1"][],
				WithSignIn<Parameters<typeof testApp.updateProductSku>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateProductSku,
					args: {
						...formAutoContent({
							quantity: faker.number.int({ min: 1, max: 2000 }),
						}),
					},
					additionalArg: [productsSkus[0].id],
				},
				UserRole.Admin,
			);

			expect(updateProductSku.statusCode).toBe(200);
		});

		it("Should apply changes in database when request is successfull", async () => {
			const updateProductSku = await testApp.withSignIn<
				Parameters<typeof testApp.updateProductSku>["1"][],
				WithSignIn<Parameters<typeof testApp.updateProductSku>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateProductSku,
					args: {
						...formAutoContent({
							quantity: productsSkus[0].quantity + 5,
						}),
					},
					additionalArg: [productsSkus[0].id],
				},
				UserRole.Admin,
			);
			expect(updateProductSku.statusCode).toBe(200);

			const dbProductSku = await testApp.app.kysely
				.selectFrom("productSku")
				.select("quantity")
				.where("id", "=", productsSkus[0].id)
				.executeTakeFirstOrThrow();

			expect(dbProductSku.quantity).not.toBe(productsSkus[0].quantity);
			expect(dbProductSku.quantity).toBe(productsSkus[0].quantity + 5);
		});

		it("Should not exceed max limits for images and packages", async () => {
			const testCases = [
				{
					packages: Array.from({ length: ProductSkuPackagesMaxLength }, () =>
						JSON.stringify({
							length: faker.number.int({ min: 1, max: 2000 }),
							quantity: faker.number.int({ min: 1, max: 2000 }),
							width: faker.number.int({ min: 1, max: 2000 }),
							height: faker.number.int({ min: 1, max: 2000 }),
							weight: faker.number.int({ min: 1, max: 2000 }),
						}),
					),
				},
				{
					images: Array.from({ length: ProductSkuImagesMaxLength }, () =>
						createReadStream(ImagePath),
					),
				},
			];

			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.updateProductSku>["1"][],
				WithSignIn<Parameters<typeof testApp.updateProductSku>["1"][]>[]
			>(
				{ body: user },
				testCases.map((data) => ({
					fn: testApp.updateProductSku,
					args: {
						...formAutoContent(data),
					},
					additionalArg: [productsSkus[0].id],
				})),
				UserRole.Admin,
			);

			for (const response of responses as LightMyRequestResponse[]) {
				if (response.statusCode !== 200) {
					console.log(response);
				}
				expect(response.statusCode).toBe(200);
			}

			const afterPackages = await testApp.app.kysely
				.selectFrom("productSkuPackage")
				.select(({ fn }) => [fn.countAll<number>().as("count")])
				.where("productSkuId", "=", productsSkus[0].id)
				.executeTakeFirstOrThrow();

			const afterImages = await testApp.app.kysely
				.selectFrom("productSkuImages")
				.select(({ fn }) => [fn.countAll<number>().as("count")])
				.where("productSkuId", "=", productsSkus[0].id)
				.executeTakeFirstOrThrow();

			expect(Number(afterPackages.count)).toBeLessThanOrEqual(
				ProductSkuPackagesMaxLength,
			);
			expect(Number(afterImages.count)).toBeLessThanOrEqual(
				ProductSkuImagesMaxLength,
			);

			expect(Number(afterPackages.count)).toBeGreaterThanOrEqual(
				productsSkus[0].packages.length,
			);
			expect(Number(afterImages.count)).toBeGreaterThanOrEqual(
				productsSkus[0].packages.length,
			);
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					name: "Empty body",
					data: {},
				},
				{
					name: "Invalid quantity",
					data: {
						quantity: "invalid",
					},
				},
				{
					name: "Invalid width",
					data: {
						width: "invalid",
					},
				},
				{
					name: "Invalid height",
					data: {
						height: "invalid",
					},
				},
				{
					name: "Invalid color",
					data: {
						color: 2321,
					},
				},
				{
					name: "Invalid currency",
					data: {
						currency: "Invalid",
					},
				},
				{
					name: "Invalid price",
					data: {
						price: "Invalid",
					},
				},
				{
					name: "Invalid sale price",
					data: {
						salePrice: "Invalid",
					},
				},
				{
					name: "Invalid images ",
					data: {
						images: "Non File",
					},
				},
				{
					name: "Sale price greater than price",
					data: {
						price: 400,
						salePrice: 500,
					},
				},
				{
					name: `Images length greater than ${ProductSkuImagesMaxLength}`,
					data: {
						images: Array.from({ length: ProductSkuImagesMaxLength + 1 }, () =>
							createReadStream(ImagePath),
						),
					},
				},
				{
					name: `Packages length greater than ${ProductSkuPackagesMaxLength}`,
					data: {
						packages: Array.from(
							{ length: ProductSkuPackagesMaxLength + 1 },
							() =>
								JSON.stringify({
									length: faker.number.int({ min: 1, max: 2000 }),
									quantity: faker.number.int({ min: 1, max: 2000 }),
									width: faker.number.int({ min: 1, max: 2000 }),
									height: faker.number.int({ min: 1, max: 2000 }),
									weight: faker.number.int({ min: 1, max: 2000 }),
								}),
						),
					},
				},
				{
					name: `Duplicate packages`,
					data: {
						packages: [
							JSON.stringify({
								length: productsSkus[0].packages[0].length,
								quantity: 5,
								width: productsSkus[0].packages[0].width,
								height: productsSkus[0].packages[0].height,
								weight: productsSkus[0].packages[0].weight,
							}),
						],
					},
				},
			];

			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.updateProductSku>["1"][],
				WithSignIn<Parameters<typeof testApp.updateProductSku>["1"][]>[]
			>(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.updateProductSku,
					args: {
						...formAutoContent(t.data),
					},
					additionalArg: [productsSkus[0].id],
				})),
				UserRole.Admin,
			);

			for (const response of responses as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(400);
			}
		});

		it("Should return 400 status code when productSku with provided attributes already exists", async () => {
			const updateProductSku = await testApp.withSignIn<
				Parameters<typeof testApp.updateProductSku>["1"][],
				WithSignIn<Parameters<typeof testApp.updateProductSku>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateProductSku,
					args: {
						...formAutoContent({
							width: productsSkus[0].attributes.width,
							length: productsSkus[0].attributes.length,
							height: productsSkus[0].attributes.height,
							color: productsSkus[0].attributes.color,
						}),
					},
				},
				UserRole.Admin,
			);

			expect(updateProductSku.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const updateProductSkuRes = await testApp.updateProductSku(
				{},
				productsSkus[0].id,
			);
			expect(updateProductSkuRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const updateProductSkuRes = await testApp.withSignIn<
				Parameters<typeof testApp.updateProductSku>["1"][],
				WithSignIn<Parameters<typeof testApp.updateProductSku>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateProductSku,
					additionalArg: [productsSkus[0].id],
				},
			);
			expect(updateProductSkuRes.statusCode).toBe(403);
		});

		it("Should return 404 status code when product doesn't exists", async () => {
			const updateProductSkuRes = await testApp.withSignIn<
				Parameters<typeof testApp.updateProductSku>["1"][],
				WithSignIn<Parameters<typeof testApp.updateProductSku>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateProductSku,
					args: {
						...formAutoContent({
							quantity: faker.number.int({ min: 1, max: 2000 }),
						}),
					},
					additionalArg: [Math.max(...productsSkus.map((p) => p.id)) + 1],
				},
				UserRole.Admin,
			);

			expect(updateProductSkuRes.statusCode).toBe(404);
		});
	});
});
