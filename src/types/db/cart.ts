import type { Selectable } from "kysely";
import type { Cart as Ct, CartItem as Cti } from "./db.js";

export type Cart = Selectable<Ct>;
export type CartItem = Selectable<Cti>;
