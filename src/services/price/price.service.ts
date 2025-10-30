import fp from "fastify-plugin"
import {FastifyInstance} from "fastify";
import {Currency} from "@/types/db/db.js";
import {getExchangeRates} from "@/services/price/get-exchange-rates.js";
import {transformPrice} from "@/services/price/transform-price.js";
import {convertCurrency} from "@/services/price/convert-currency.js";
import {applyPromocode} from "@/services/price/apply-promocode.js";


declare module "fastify" {
	export interface FastifyInstance {
		priceService: PriceService
	}
}

export class PriceService {
	exchangeRateRequestUrl: string
	currencyMultiplier: Record<Currency, number> = {
		[Currency.Rub]: 100,
		[Currency.Usd]: 100,
		[Currency.Eur]: 100,
	};

	exchangeRates: Record<Currency, number> | undefined;

	getExchangeRates = getExchangeRates
	transformPrice = transformPrice
	convertCurrency = convertCurrency
	applyPromocode = applyPromocode


	constructor(readonly fastify: FastifyInstance) {
		this.exchangeRateRequestUrl = `${this.fastify.config.exchangeRate.baseUrl}${this.fastify.config.exchangeRate.apiKey}/latest/RUB`;
	}

}


export default fp(async (fastify: FastifyInstance) => {
	fastify.decorate("priceService", new PriceService(fastify))
}, {
	name: "priceService",
	dependencies: ["redis"]
})