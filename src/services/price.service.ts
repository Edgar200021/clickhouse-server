import type { FastifyInstance } from "fastify/types/instance.js";
import { ExchangeRatesKey } from "../const/redis.js";
import { Currency } from "../types/db/db.js";
import type { Promocode } from "../types/db/promocode.js";

type ExchangeRateResponse =
	| {
			result: "success";
			conversion_rates: Record<Currency, number>;
	  }
	| {
			result: "error";
			"error-type":
				| "unsupported-code"
				| "malformed-request"
				| "invalid-key"
				| "inactive-account"
				| "quota-reached";
	  };

export function createPriceService({
	log,
	config,
	httpErrors,
	redis,
}: FastifyInstance) {
	const exchangeRateRequestUrl = `${config.exchangeRate.baseUrl}${config.exchangeRate.apiKey}/latest/RUB`;
	const currencyMultiplier: Record<Currency, number> = {
		[Currency.Rub]: 100,
		[Currency.Usd]: 100,
		[Currency.Eur]: 100,
	};

	let exchangeRates: Record<Currency, number> | undefined;

	async function getExchangeRates() {
		const cachedRates = await redis.get(ExchangeRatesKey);
		if (cachedRates)
			exchangeRates = JSON.parse(cachedRates) as Record<Currency, number>;

		if (exchangeRates) return;

		const res = await fetch(exchangeRateRequestUrl);
		const data: ExchangeRateResponse =
			(await res.json()) as ExchangeRateResponse;

		if (data.result === "error") {
			log.error(`Error getting exchange rates: ${data["error-type"]}`);
		} else {
			exchangeRates = data.conversion_rates;
			await redis.setex(
				ExchangeRatesKey,
				86400,
				JSON.stringify(data.conversion_rates),
			);
		}
	}

	function transformPrice(
		price: number,
		currency: Currency,
		mode: "store" | "read",
	): number {
		const m = currencyMultiplier[currency];

		if (mode === "store") return Math.round(price * m);
		return price / m;
	}

	function convertCurrency(amount: number, from: Currency, to: Currency) {
		if (from === to) return amount;
		if (!exchangeRates)
			throw httpErrors.internalServerError(`No exchange rates available`);

		const rateFrom = exchangeRates[from];
		const rateTo = exchangeRates[to];

		const amountInRub = amount / rateFrom;
		return Math.round(amountInRub * rateTo);
	}

	function applyPromocode(amount: number, promocode: Promocode): number {
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

	return {
		getExchangeRates,
		transformPrice,
		convertCurrency,
		applyPromocode,
	};
}
