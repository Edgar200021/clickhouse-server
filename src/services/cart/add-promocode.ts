import type {User} from "@/types/db/user.js";
import type {AddCartPromocodeRequest} from "@/schemas/cart/add-cart-promocode.schema.js";
import type {FastifyBaseLogger} from "fastify";
import type {Promocode} from "@/types/db/promocode.js";
import {OrderStatus} from "@/types/db/db.js";
import {type CartService} from "@/services/cart/cart.service.js";

export async function addPromocode(
	this: CartService,
	userId: User["id"],
	data: AddCartPromocodeRequest,
	log: FastifyBaseLogger,
): Promise<Pick<Promocode, "code" | "type" | "discountValue" | "validTo">> {
	const {fastify: {promocodeService, httpErrors, kysely}, getUserCart} = this
	const cart = await getUserCart(userId, {
		log,
		logMsg: "Add cart promocode failed: cart not found",
	});

	const promocode = await promocodeService.get(
		{
			type: "code",
			code: data.promocode,
		},
		{
			validate: true,
			onError: (msg) => log.info(`Add cart promocode failed: ${msg}`),
		},
	);

	const isValid = promocodeService.isValid(promocode);

	if (!isValid.valid) {
		log.info(
			{promocodeId: promocode.id},
			`Add cart promocode failed: ${isValid.reason}`,
		);
		throw httpErrors.badRequest("Promocode is not valid");
	}

	const isUsed = await kysely
		.selectFrom("order")
		.where((eb) =>
			eb.and([
				eb("status", "!=", OrderStatus.Cancelled),
				eb("promocodeId", "=", promocode.id),
				eb("userId", "=", userId),
			]),
		)
		.executeTakeFirst();

	if (isUsed) {
		log.info(
			{promocodeId: promocode.id, userId},
			"Add cart promocode failed: promocode already used in a previous order",
		);
		throw httpErrors.badRequest(
			"This promocode has already been used in a previous order",
		);
	}

	await kysely
		.updateTable("cart")
		.set({promocodeId: promocode.id})
		.where("id", "=", cart.id)
		.execute();

	return {
		code: promocode.code,
		type: promocode.type,
		discountValue: promocode.discountValue,
		validTo: promocode.validTo,
	};
}