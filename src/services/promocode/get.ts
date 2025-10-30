import {Promocode} from "@/types/db/promocode.js";
import {type PromocodeService} from "@/services/promocode/promocode.service.js";

export async function get<T extends boolean>(
	this: PromocodeService,
	type:
		| {
		type: "code";
		code: Promocode["code"];
	}
		| {
		type: "id";
		id: Promocode["id"];
	},
	opts: {
		validate: T;
		onError?: (err: string) => void;
	} = {validate: true as T},
): Promise<T extends true ? Promocode : Promocode | undefined> {
	const {kysely, httpErrors} = this.fastify

	const promocode = await kysely
		.selectFrom("promocode")
		.selectAll()
		.where((eb) => {
			if (type.type === "code") {
				return eb("code", "=", type.code);
			}

			return eb("id", "=", type.id);
		})
		.executeTakeFirst();

	if (opts.validate) {
		if (!promocode) {
			opts.onError?.("promocode not found");
			throw httpErrors.notFound("Promocode not found");
		}

		const validationResult = this.isValid(promocode);
		if (!validationResult.valid) {
			opts.onError?.(validationResult.reason);
			throw httpErrors.badRequest(validationResult.reason);
		}
	}

	return promocode as T extends true ? Promocode : Promocode | undefined;
}