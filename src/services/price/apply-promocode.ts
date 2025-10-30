import type {Promocode} from "@/types/db/promocode.js";
import {type PriceService} from "@/services/price/price.service.js";

export function applyPromocode(this: PriceService, amount: number, promocode: Promocode): number {
	let discount = 0;

	switch (promocode.type) {
		case "fixed":
			discount = Number(promocode.discountValue);
			break;
		case "percent":
			discount = (amount * Number(promocode.discountValue)) / 100;
			break;
	}

	return Math.max(amount - discount, 0);
}