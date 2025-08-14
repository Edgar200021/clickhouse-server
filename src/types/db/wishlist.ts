import type { Selectable } from "kysely";
import type { Wishlist as Wl } from "./db.js";

export type Wishlist = Selectable<Wl>;
