import type { GetOrdersAdminRequestQuery } from "@/schemas/order/get-orders-admin.schema.js";
import type {
	GetAllResult,
	OrderService,
} from "@/services/order/order.service.js";
import type { WithPageCount } from "@/types/base.js";
import { UserRole } from "@/types/db/db.js";

export async function getAll(
	this: OrderService,
	query: GetOrdersAdminRequestQuery,
): Promise<WithPageCount<GetAllResult<UserRole.Admin>[], "orders">> {
	const orders = await this.getOrders<UserRole.Admin>(
		query,
		UserRole.Admin,
		undefined,
	);

	return orders;
}
