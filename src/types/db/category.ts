import type { Selectable } from "kysely";
import type { Category as Ct } from "./db.js";

export type Category = Selectable<Ct>;
