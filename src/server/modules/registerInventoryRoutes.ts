import type { Express } from "express";
import { inventoryRoutes } from "../../modules/inventory/server/routes/inventoryRoutes";

export function registerInventoryRoutes(app: Express) {
  app.use(inventoryRoutes());
}
