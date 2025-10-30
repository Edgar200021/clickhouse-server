import type { FastifyBaseLogger } from "fastify";
import type { OrderParam } from "@/schemas/order/order-param.schema.js";
import type {
	GetOneResult,
	OrderService,
} from "@/services/order/order.service.js";
import { UserRole } from "@/types/db/db.js";
import type { User } from "@/types/db/user.js";

export async function getOneByUserId(
	this: OrderService,
	userId: User["id"],
	param: OrderParam,
	log: FastifyBaseLogger,
): Promise<GetOneResult<UserRole.Regular>> {
	const order = await this.getOrder(param, UserRole.Regular, userId, log);

	return order;
}
