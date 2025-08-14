import type { Selectable } from "kysely";
import type { Manufacturer as Mf } from "./db.js";

export type Manufacturer = Selectable<Mf>;
