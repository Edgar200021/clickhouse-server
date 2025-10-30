import type { GetOrdersRequestQuery } from "@/schemas/order/get-orders.schema.js";
import type {
	GetAllResult,
	OrderService,
} from "@/services/order/order.service.js";
import type { WithPageCount } from "@/types/base.js";
import { UserRole } from "@/types/db/db.js";
import type { User } from "@/types/db/user.js";

export async function getAllByUserId(
	this: OrderService,
	userId: User["id"],
	query: GetOrdersRequestQuery,
): Promise<WithPageCount<GetAllResult<UserRole.Regular>[], "orders">> {
	const orders = await this.getOrders<UserRole.Regular>(
		query,
		UserRole.Regular,
		userId,
	);

	return orders;
}
