import fp from "fastify-plugin"
import {type FastifyBaseLogger, FastifyInstance} from "fastify";
import {getAll} from "@/services/product-sku/get-all.js";
import {getOne} from "@/services/product-sku/get-one.js";
import {create} from "@/services/product-sku/create.js";
import {update} from "@/services/product-sku/update.js";
import {remove} from "@/services/product-sku/remove.js";
import {Currency, type DB, UserRole} from "@/types/db/db.js";
import type {Expression, ExpressionBuilder, ExpressionWrapper, SqlBool} from "kysely";
import type {ProductSkuAttributes} from "@/schemas/product-sku/product-sku.schema.js";
import {isDatabaseError} from "@/types/db/error.js";
import {DuplicateCode, ForeignKeyConstraintCode} from "@/const/database.js";
import type {Combined} from "@/types/base.js";
import type {Product, ProductSku, ProductSkuImages, ProductSkuPackage} from "@/types/db/product.js";
import type {
	GetProductsSkusAdminRequestQuery
} from "@/schemas/product-sku/get-products-skus-admin.schema.js";
import type {GetProductsSkusRequestQuery} from "@/schemas/product-sku/get-products-skus.schema.js";
import {deleteImage} from "@/services/product-sku/delete-image.js";
import {deletePackage} from "@/services/product-sku/delete-package.js";
import {buildAdminProductSku} from "@/services/product-sku/build-admin-product-sku.js";
import {getPopularProducts} from "@/services/product-sku/get-popular-products.js";
import {updatePopularProductsCache} from "@/services/product-sku/update-popular-products-cache.js";


declare module "fastify" {
	export interface FastifyInstance {
		productSkuService: ProductSkuService
	}
}


export type GetOneResult<T extends UserRole> = T extends UserRole.Admin
	? Combined<
		Omit<ProductSku, "productId" | "attributes"> & {
		attributes: ProductSkuAttributes;
		images: Pick<ProductSkuImages, "id" | "imageId" | "imageUrl">[];
		packages: Omit<ProductSkuPackage, "productSkuId">[];
	},
		Product,
		"product"
	>
	: Combined<
		Omit<
			ProductSku,
			"productId" | "attributes" | "createdAt" | "updatedAt"
		> & {
		attributes: ProductSkuAttributes;
		images: Pick<ProductSkuImages, "imageId" | "imageUrl">[];
		packages: Omit<
			ProductSkuPackage,
			"productSkuId" | "id" | "createdAt" | "updatedAt"
		>[];
	},
		Omit<
			Product,
			"id" | "createdAt" | "manufacturerId" | "updatedAt" | "isDeleted"
		>,
		"product"
	>;

export type GetAllQuery<T extends UserRole> = T extends UserRole.Admin
	? GetProductsSkusAdminRequestQuery
	: GetProductsSkusRequestQuery;


export class ProductSkuService {
	getAll = getAll
	getOne = getOne
	getPopularProducts = getPopularProducts
	create = create
	update = update
	remove = remove
	deleteImage = deleteImage
	deletePackage = deletePackage
	buildAdminProductSku = buildAdminProductSku
	updatePopularProductsCache = updatePopularProductsCache

	constructor(readonly fastify: FastifyInstance) {
		this.buildFilters = this.buildFilters.bind(this)
		this.buildAttributes = this.buildAttributes.bind(this)
		this.handleError = this.handleError.bind(this)
		this.mapOneResult = this.mapOneResult.bind(this)
	}

	mapOneResult<T extends UserRole>(product, role: T): GetOneResult<T> {
		if (role === UserRole.Admin) {
			return {
				id: product.id,
				createdAt: product.createdAt,
				updatedAt: product.updatedAt,
				price: this.fastify.priceService.transformPrice(product.price, Currency.Rub, "read"),
				salePrice: product.salePrice
					? this.fastify.priceService.transformPrice(product.salePrice, Currency.Rub, "read")
					: null,
				quantity: product.quantity,
				sku: product.sku,
				attributes: product.attrs,
				images: product.images,
				packages: product.packages,
				product: {
					id: product.pid,
					createdAt: product.pcr,
					updatedAt: product.pup,
					name: product.name,
					description: product.description,
					shortDescription: product.shortDescription,
					materialsAndCare: product.materialsAndCare,
					assemblyInstructionFileId: product.assemblyInstructionFileId,
					assemblyInstructionFileUrl: product.assemblyInstructionFileUrl,
					isDeleted: product.isDeleted,
					categoryId: product.categoryId,
					manufacturerId: product.manufacturerId,
				},
			} as GetOneResult<T>
		}


		return {
			id: product.id,
			price: this.fastify.priceService.transformPrice(product.price, Currency.Rub, "read"),
			salePrice: product.salePrice
				? this.fastify.priceService.transformPrice(product.salePrice, Currency.Rub, "read")
				: null,
			quantity: product.quantity,
			sku: product.sku,
			attributes: product.attrs,
			images: product.images,
			packages: product.packages,
			product: {
				name: product.name,
				categoryId: product.categoryId,
				description: product.description,
				shortDescription: product.shortDescription,
				materialsAndCare: product.materialsAndCare,
				assemblyInstructionFileId: product.assemblyInstructionFileId,
				assemblyInstructionFileUrl: product.assemblyInstructionFileUrl,
			},
		} as GetOneResult<T>
	}

	buildFilters<T extends UserRole>(
		query: GetAllQuery<T>,
		eb: ExpressionBuilder<DB, "product" | "productSku">,
		role: T,
	): ExpressionWrapper<DB, "productSku" | "product", SqlBool> {
		const ands: Expression<SqlBool>[] = [];

		if (role === UserRole.Regular) {
			ands.push(eb("product.isDeleted", "=", false));
		}

		if (role === UserRole.Admin && "isDeleted" in query) {
			if (query.isDeleted !== undefined) {
				ands.push(eb("product.isDeleted", "=", query.isDeleted));
			}
		}

		if ("categoryId" in query && query.categoryId) {
			ands.push(eb("product.categoryId", "=", query.categoryId));
		}

		if (query.search) {
			ands.push(
				eb.or([
					eb("product.name", "ilike", `%${query.search}%`),
					eb("product.description", "ilike", `%${query.search}%`),
					eb("product.shortDescription", "ilike", `%${query.search}%`),
				]),
			);
		}

		if (query.minPrice) {
			ands.push(
				eb(
					"productSku.price",
					">=",
					this.fastify.priceService.transformPrice(query.minPrice, Currency.Rub, "store"),
				),
			);
		}

		if (query.maxPrice) {
			ands.push(
				eb(
					"productSku.price",
					"<=",
					this.fastify.priceService.transformPrice(query.maxPrice, Currency.Rub, "store"),
				),
			);
		}

		if (query.minSalePrice) {
			ands.push(
				eb(
					"productSku.salePrice",
					">=",
					this.fastify.priceService.transformPrice(query.minSalePrice, Currency.Rub, "store"),
				),
			);
		}

		if (query.maxSalePrice) {
			ands.push(
				eb(
					"productSku.salePrice",
					"<=",
					this.fastify.priceService.transformPrice(query.maxSalePrice, Currency.Rub, "store"),
				),
			);
		}

		if (query.sku) {
			ands.push(eb("productSku.sku", "=", query.sku));
		}

		if (query.inStock !== undefined) {
			ands.push(eb("productSku.quantity", ">", 1));
		}

		if (query.withDiscount !== undefined) {
			ands.push(eb("productSku.salePrice", "is not", null));
		}

		return eb.and(ands);
	}

	buildAttributes(attr: ProductSkuAttributes) {
		const attributeKeys = ["width", "height", "color", "length"];
		const attributeValues = [attr.width, attr.height, attr.color, attr.length];

		if (attr.weight) {
			attributeKeys.push("length");
			attributeValues.push(attr.weight);
		}

		return {
			attributeKeys,
			attributeValues,
		};
	}

	handleError(
		err: unknown,
		data: unknown,
		log: FastifyBaseLogger,
	): Error | unknown {
		if (isDatabaseError(err)) {
			let logMsg = "";
			let clientMsg = "";

			switch (err.code) {
				case DuplicateCode:
					if (err.table === "product_sku_package") {
						logMsg = "Duplicate packages";
						clientMsg = "Duplicate packages";
					} else {
						logMsg = "Create product SKU failed: duplicate attributes";
						clientMsg = "Product with these characteristics already exists";
					}
					break;

				case ForeignKeyConstraintCode:
					logMsg = "Product doesn't exist";
					clientMsg = "Product doesn't exist";
					break;
			}

			if (logMsg) {
				log.info({data}, logMsg);
				return err.code === ForeignKeyConstraintCode
					? this.fastify.httpErrors.notFound(clientMsg)
					: this.fastify.httpErrors.badRequest(clientMsg);
			}
		}

		return err;
	}
}


export default fp(async (fastify: FastifyInstance) => {
	fastify.decorate("productSkuService", new ProductSkuService(fastify))
}, {
	name: "productSkuService",
	dependencies: ["priceService", "fileUploaderManager"]
})