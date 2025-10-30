import type {Promocode} from "@/types/db/promocode.js";
import {constructNow, isAfter, isBefore} from "date-fns";
import {type PromocodeService} from "@/services/promocode/promocode.service.js";

export function isValid(
	this: PromocodeService,
	promocode: Promocode,
): { valid: true } | { valid: false; reason: string } {
	const now = constructNow(undefined);

	if (isBefore(now, promocode.validFrom))
		return {valid: false, reason: "Promocode not active yet"};
	if (isAfter(now, promocode.validTo))
		return {valid: false, reason: "Promocode expired"};
	if (promocode.usageCount >= promocode.usageLimit)
		return {valid: false, reason: "Promocode is inactive"};
	return {valid: true};
}