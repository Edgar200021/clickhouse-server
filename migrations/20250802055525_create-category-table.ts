import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`CREATE EXTENSION IF NOT EXISTS ltree;`.execute(db);

	await db.schema
		.createTable("category")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().generatedAlwaysAsIdentity(),
		)
		.addColumn("created_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamp", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("path", sql`ltree`, (col) => col.notNull().unique())
		.addColumn("image_id", "text")
		.addColumn("image_url", "text")
		.execute();

	await sql`CREATE INDEX idx_category_path_gist ON category USING GIST(path)`.execute(
		db,
	);

	await db
		.insertInto("category")
		.values([
			{ name: "Мебель", path: "Furniture" },
			{ name: "Шкафы", path: "Furniture.Cabinets" },
			{ name: "Шкафы-купе", path: "Furniture.Cabinets.Sliding" },
			{ name: "Стеллажи", path: "Furniture.Shelves" },
			{ name: "Книжные шкафы", path: "Furniture.Shelves.Bookcases" },
			{ name: "Столы", path: "Furniture.Tables" },
			{ name: "Стулья", path: "Furniture.Chairs" },
			{ name: "Кровати", path: "Furniture.Beds" },

			{ name: "Аксессуары для создания уюта", path: "CozyAccessories" },
			{ name: "Постельное белье", path: "CozyAccessories.Bedding" },
			{
				name: "Комплекты постельного белья",
				path: "CozyAccessories.Bedding.Sets",
			},
			{ name: "Одеяла", path: "CozyAccessories.Blankets" },

			{ name: "Подушки", path: "CozyAccessories.Pillows" },
			{ name: "Пледы", path: "CozyAccessories.Plids" },

			{ name: "Хранение и порядок", path: "Storage" },
			{ name: "Аксессуары для хранения", path: "Storage.Accessories" },
			{ name: "Крючки и полки на стену", path: "Storage.WallHooksAndShelves" },
			{
				name: "Обувницы, полки с крючками для хранения",
				path: "Storage.ShoeRacksAndHooks",
			},
			{
				name: "Вешалки, обувницы, полки с крючками для хранения",
				path: "Storage.HangersAndShoeRacks",
			},
			{ name: "Системы для хранения", path: "Storage.StorageSystems" },
			{ name: "Шкафы и шкафы-купе", path: "Storage.Cabinets" },

			{ name: "Аксессуары", path: "Accessories" },
			{ name: "Шкафы и шкафы-купе", path: "Accessories.Cabinets" },
			{
				name: "Стеллажи и книжные шкафы",
				path: "Accessories.ShelvesAndBookcases",
			},
			{ name: "Столы", path: "Accessories.Tables" },
			{ name: "Стулья", path: "Accessories.Chairs" },
			{ name: "Кровати", path: "Accessories.Beds" },

			{ name: "Декор для дома", path: "HomeDecor" },
			{ name: "Вазы и миски", path: "HomeDecor.VasesAndBowls" },
			{ name: "Зеркала", path: "HomeDecor.Mirrors" },
			{ name: "Коробки и корзины", path: "HomeDecor.BoxesAndBaskets" },
		])
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("category").execute();
}
