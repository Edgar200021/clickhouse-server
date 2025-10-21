import type { Selectable } from "kysely";
import type { Order as Or, OrderItem as Ori } from "./db.js";

export type Order = Selectable<Or>;
export type OrderItem = Selectable<Ori>;
