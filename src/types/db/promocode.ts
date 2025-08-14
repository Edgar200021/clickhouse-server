import type { Selectable } from "kysely";
import type { Promocode as Pc } from "./db.js";

export type Promocode = Selectable<Pc>;
