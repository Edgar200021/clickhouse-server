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
import { Currency, UserRole } from "../../../../src/types/db/db.js";
import type { Product, ProductSku } from "../../../../src/types/db/product.js";
import { buildTestApp, ImagePath } from "../../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let products: Product[];
	let productsSkus: (Omit<ProductSku, "attributes" | "productId"> &
		Product & { attributes: ProductSkuAttributes })[];

	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();

		const res = await Promise.all([
			testApp.app.kysely.selectFrom("product").selectAll().execute(),
			testApp.app.kysely
				.selectFrom("productSku")
				.innerJoin("product", "product.id", "productSku.productId")
				.select([
					"product.id as pid",
					"product.createdAt as pcr",
					"product.updatedAt as pup",
					"product.name",
					"product.description",
					"product.shortDescription",
					"product.materialsAndCare",
					"product.isDeleted",
					"product.assemblyInstructionFileId",
					"product.assemblyInstructionFileUrl",
					"product.categoryId",
					"product.manufacturerId",
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
				.execute(),
		]);

		products = res[0];
		productsSkus = res[1];
	});

	afterEach(async () => await testApp.close());

	describe("Create Product Sku", () => {
		it("Should return 201 status code when request is successfull", async () => {
			const createProductSkuRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createProductSku,
					args: {
						...formAutoContent({
							productId: products[0].id,
							quantity: faker.number.int({ min: 1, max: 2000 }),
							width: faker.number.int({ min: 1, max: 2000 }),
							length: faker.number.int({ min: 1, max: 2000 }),
							height: faker.number.int({ min: 1, max: 2000 }),
							color: faker.color.human(),
							currency: Currency.Rub,
							price: faker.number.int({ min: 1, max: 2000 }),
							images: [createReadStream(ImagePath)],
						}),
					},
				},
				UserRole.Admin,
			);

			expect(createProductSkuRes.statusCode).toBe(201);
		});

		it("Should save into database when request is successful", async () => {
			const width = faker.number.int({ min: 1, max: 2000 });
			const length = faker.number.int({ min: 1, max: 2000 });
			const height = faker.number.int({ min: 1, max: 2000 });
			const color = faker.color.human();

			const createProductSkuRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createProductSku,
					args: {
						...formAutoContent({
							productId: products[0].id,
							quantity: faker.number.int({ min: 1, max: 2000 }),
							width,
							length,
							height,
							color,
							currency: Currency.Rub,
							price: faker.number.int({ min: 1, max: 2000 }),
							images: [createReadStream(ImagePath)],
							packages: Array.from(
								{ length: ProductSkuPackagesMaxLength },
								() =>
									JSON.stringify({
										length: faker.number.int({ min: 1, max: 2000 }),
										quantity: faker.number.int({ min: 1, max: 2000 }),
										width: faker.number.int({ min: 1, max: 2000 }),
										height: faker.number.int({ min: 1, max: 2000 }),
										weight: faker.number.int({ min: 1, max: 2000 }),
									}),
							),
						}),
					},
				},
				UserRole.Admin,
			);

			expect(createProductSkuRes.statusCode).toBe(201);

			const dbProductSku = await testApp.app.kysely
				.selectFrom("productSku")
				.where("productId", "=", products[0].id)
				.selectAll()
				.where((eb) =>
					eb.and([
						sql<boolean>`product_sku.attributes -> 'width' = ${width}`,
						sql<boolean>`product_sku.attributes -> 'length' = ${length}`,
						sql<boolean>`product_sku.attributes -> 'height' = ${height}`,
						sql<boolean>`product_sku.attributes -> 'color' = ${color}`,
					]),
				)
				.executeTakeFirst();

			expect(dbProductSku).toBeDefined();
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					name: "Missing quantity",
					data: {
						productId: products[0].id,
						width: faker.number.int({ min: 1, max: 2000 }),
						length: faker.number.int({ min: 1, max: 2000 }),
						height: faker.number.int({ min: 1, max: 2000 }),
						color: faker.color.human(),
						currency: Currency.Rub,
						price: faker.number.int({ min: 1, max: 2000 }),
						images: [createReadStream(ImagePath)],
					},
				},
				{
					name: "Missing width",
					data: {
						productId: products[2].id,
						quantity: faker.number.int({ min: 1, max: 2000 }),
						length: faker.number.int({ min: 1, max: 2000 }),
						height: faker.number.int({ min: 1, max: 2000 }),
						color: faker.color.human(),
						currency: Currency.Rub,
						price: faker.number.int({ min: 1, max: 2000 }),
						images: [createReadStream(ImagePath)],
					},
				},
				{
					name: "Missing length",
					data: {
						productId: products[3].id,
						quantity: faker.number.int({ min: 1, max: 2000 }),
						width: faker.number.int({ min: 1, max: 2000 }),
						height: faker.number.int({ min: 1, max: 2000 }),
						color: faker.color.human(),
						currency: Currency.Rub,
						price: faker.number.int({ min: 1, max: 2000 }),
						images: [createReadStream(ImagePath)],
					},
				},
				{
					name: "Missing height",
					data: {
						productId: products[4].id,
						quantity: faker.number.int({ min: 1, max: 2000 }),
						width: faker.number.int({ min: 1, max: 2000 }),
						length: faker.number.int({ min: 1, max: 2000 }),
						color: faker.color.human(),
						currency: Currency.Rub,
						price: faker.number.int({ min: 1, max: 2000 }),
						images: [createReadStream(ImagePath)],
					},
				},
				{
					name: "Missing color",
					data: {
						productId: products[5].id,
						quantity: faker.number.int({ min: 1, max: 2000 }),
						width: faker.number.int({ min: 1, max: 2000 }),
						length: faker.number.int({ min: 1, max: 2000 }),
						height: faker.number.int({ min: 1, max: 2000 }),
						currency: Currency.Rub,
						price: faker.number.int({ min: 1, max: 2000 }),
						images: [createReadStream(ImagePath)],
					},
				},
				{
					name: "Missing currency",
					data: {
						productId: products[6].id,
						quantity: faker.number.int({ min: 1, max: 2000 }),
						width: faker.number.int({ min: 1, max: 2000 }),
						length: faker.number.int({ min: 1, max: 2000 }),
						height: faker.number.int({ min: 1, max: 2000 }),
						color: faker.color.human(),
						price: faker.number.int({ min: 1, max: 2000 }),
						images: [createReadStream(ImagePath)],
					},
				},
				{
					name: "Missing price",
					data: {
						productId: products[7].id,
						quantity: faker.number.int({ min: 1, max: 2000 }),
						width: faker.number.int({ min: 1, max: 2000 }),
						length: faker.number.int({ min: 1, max: 2000 }),
						height: faker.number.int({ min: 1, max: 2000 }),
						color: faker.color.human(),
						currency: Currency.Rub,
						images: [createReadStream(ImagePath)],
					},
				},
				{
					name: "Sale price greater than price",
					data: {
						productId: products[8].id,
						quantity: faker.number.int({ min: 1, max: 2000 }),
						width: faker.number.int({ min: 1, max: 2000 }),
						length: faker.number.int({ min: 1, max: 2000 }),
						height: faker.number.int({ min: 1, max: 2000 }),
						color: faker.color.human(),
						price: 400,
						salePrice: 500,
						currency: Currency.Rub,
						images: [createReadStream(ImagePath)],
					},
				},
				{
					name: "Missing images",
					data: {
						productId: products[9].id,
						quantity: faker.number.int({ min: 1, max: 2000 }),
						width: faker.number.int({ min: 1, max: 2000 }),
						length: faker.number.int({ min: 1, max: 2000 }),
						height: faker.number.int({ min: 1, max: 2000 }),
						color: faker.color.human(),
						price: 400,
						salePrice: 500,
						currency: Currency.Rub,
						images: [],
					},
				},
				{
					name: `Images length greater than ${ProductSkuImagesMaxLength}`,
					data: {
						productId: products[10].id,
						quantity: faker.number.int({ min: 1, max: 2000 }),
						width: faker.number.int({ min: 1, max: 2000 }),
						length: faker.number.int({ min: 1, max: 2000 }),
						height: faker.number.int({ min: 1, max: 2000 }),
						color: faker.color.human(),
						price: 400,
						salePrice: 500,
						currency: Currency.Rub,
						images: Array.from({ length: ProductSkuImagesMaxLength + 1 }, () =>
							createReadStream(ImagePath),
						),
					},
				},
				{
					name: `Packages length greater than ${ProductSkuPackagesMaxLength}`,
					data: {
						productId: products[11].id,
						quantity: faker.number.int({ min: 1, max: 2000 }),
						width: faker.number.int({ min: 1, max: 2000 }),
						length: faker.number.int({ min: 1, max: 2000 }),
						height: faker.number.int({ min: 1, max: 2000 }),
						color: faker.color.human(),
						price: 400,
						salePrice: 500,
						currency: Currency.Rub,
						images: [createReadStream(ImagePath)],
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
						productId: products[12].id,
						quantity: faker.number.int({ min: 1, max: 2000 }),
						width: faker.number.int({ min: 1, max: 2000 }),
						length: faker.number.int({ min: 1, max: 2000 }),
						height: faker.number.int({ min: 1, max: 2000 }),
						color: faker.color.human(),
						price: 400,
						salePrice: 500,
						currency: Currency.Rub,
						images: [createReadStream(ImagePath)],
						packages: [
							JSON.stringify({
								length: 50,
								quantity: 50,
								width: 50,
								height: 50,
								weight: 50,
							}),
							JSON.stringify({
								length: 50,
								quantity: 50,
								width: 50,
								height: 50,
								weight: 50,
							}),
						],
					},
				},
			];
			const responses = await testApp.withSignIn(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.createProductSku,
					args: {
						...formAutoContent(t.data),
					},
				})),
				UserRole.Admin,
			);

			for (const response of responses as unknown as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(400);
			}
		});

		it("Should return 400 status code when productSku with provided attributes already exists", async () => {
			const responses = await testApp.withSignIn(
				{ body: user },
				[
					{
						fn: testApp.createProductSku,
						args: {
							...formAutoContent({
								productId: products[0].id,
								quantity: faker.number.int({ min: 1, max: 2000 }),
								width: 50,
								length: 50,
								height: 50,
								color: "blue",
								currency: Currency.Rub,
								price: faker.number.int({ min: 1, max: 2000 }),
								images: [createReadStream(ImagePath)],
							}),
						},
					},
					{
						fn: testApp.createProductSku,
						args: {
							...formAutoContent({
								productId: products[0].id,
								quantity: faker.number.int({ min: 1, max: 2000 }),
								width: 50,
								length: 50,
								height: 50,
								color: "blue",
								currency: Currency.Rub,
								price: faker.number.int({ min: 1, max: 2000 }),
								images: [createReadStream(ImagePath)],
							}),
						},
					},
				],
				UserRole.Admin,
			);

			const badRequestRes = (
				responses as unknown as LightMyRequestResponse[]
			).find((res) => res.statusCode === 400);

			expect(badRequestRes).toBeDefined();
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const createProductSkuRes = await testApp.createProductSku({});
			expect(createProductSkuRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const createProductSkuRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createProductSku,
				},
			);
			expect(createProductSkuRes.statusCode).toBe(403);
		});

		it("Should return 404 status code when product doesn't exists", async () => {
			const createProductSkuRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createProductSku,
					args: {
						...formAutoContent({
							productId: Math.max(...products.map((p) => p.id)) + 1,
							quantity: faker.number.int({ min: 1, max: 2000 }),
							width: faker.number.int({ min: 1, max: 2000 }),
							length: faker.number.int({ min: 1, max: 2000 }),
							height: faker.number.int({ min: 1, max: 2000 }),
							color: faker.color.human(),
							currency: Currency.Rub,
							price: faker.number.int({ min: 1, max: 2000 }),
							images: [createReadStream(ImagePath)],
						}),
					},
				},
				UserRole.Admin,
			);

			expect(createProductSkuRes.statusCode).toBe(404);
		});
	});
});
