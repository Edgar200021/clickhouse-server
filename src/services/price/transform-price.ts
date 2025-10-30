import {Currency} from "@/types/db/db.js";
import {type PriceService} from "@/services/price/price.service.js";

export function transformPrice(
	this: PriceService,
	price: number,
	currency: Currency,
	mode: "store" | "read",
): number {
	const m = this.currencyMultiplier[currency];

	if (mode === "store") return Math.round(price * m);
	return price / m;
}