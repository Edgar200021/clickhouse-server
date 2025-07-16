import type { Selectable } from "kysely";
import type { Users } from "./db.js";

export type User = Selectable<Users>;
