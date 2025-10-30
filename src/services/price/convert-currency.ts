import {Currency} from "@/types/db/db.js";
import {type PriceService} from "@/services/price/price.service.js";

export function convertCurrency(this: PriceService, amount: number, from: Currency, to: Currency) {
	if (from === to) return amount;
	if (!this.exchangeRates)
		throw this.fastify.httpErrors.internalServerError(`No exchange rates available`);

	const rateFrom = this.exchangeRates[from];
	const rateTo = this.exchangeRates[to];

	const amountInRub = amount / rateFrom;
	return Math.round(amountInRub * rateTo);
}