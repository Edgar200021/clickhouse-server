import type { Selectable } from "kysely";
import type {
	Product as Pr,
	ProductSku as Prs,
	ProductSkuImages as Prsi,
	ProductSkuPackage as Prsp,
} from "./db.js";

export type Product = Selectable<Pr>;
export type ProductSku = Selectable<Prs>;
export type ProductSkuImages = Selectable<Prsi>;
export type ProductSkuPackage = Selectable<Prsp>;
