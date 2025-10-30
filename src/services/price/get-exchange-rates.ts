import {type PriceService} from "@/services/price/price.service.js";
import {FastifyBaseLogger} from "fastify";
import {Currency} from "@/types/db/db.js";
import {ExchangeRatesKey} from "@/const/redis.js";

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


export async function getExchangeRates(
	this: PriceService,
	log: FastifyBaseLogger,
): Promise<Record<Currency, number> | null> {
	const cachedRates = await this.fastify.redis.get(ExchangeRatesKey);
	if (cachedRates)
		this.exchangeRates = JSON.parse(cachedRates) as Record<Currency, number>;

	if (this.exchangeRates) return this.exchangeRates;

	const res = await fetch(this.exchangeRateRequestUrl);
	const data: ExchangeRateResponse =
		(await res.json()) as ExchangeRateResponse;

	if (data.result === "error") {
		log.info(`Error getting exchange rates: ${data["error-type"]}`);
		return null;
	} else {
		this.exchangeRates = data.conversion_rates;
		await this.fastify.redis.setex(
			ExchangeRatesKey,
			86400,
			JSON.stringify(data.conversion_rates),
		);
		return this.exchangeRates;
	}
}