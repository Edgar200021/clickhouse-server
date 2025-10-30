import type { FastifyBaseLogger } from "fastify";
import type { OrderParam } from "@/schemas/order/order-param.schema.js";
import type {
	GetOneResult,
	OrderService,
} from "@/services/order/order.service.js";
import { UserRole } from "@/types/db/db.js";

export async function getOne(
	this: OrderService,
	param: OrderParam,
	log: FastifyBaseLogger,
): Promise<GetOneResult<UserRole.Admin>> {
	const order = await this.getOrder(param, UserRole.Admin, undefined, log);

	return order;
}
