export const PRODUCTION_DISABLED_MIGRATIONS: ReadonlySet<string> = new Set([
  "004_demo_seed.sql",
]);

export function isProductionDisabledMigration(
  filename: string,
  nodeEnv: string,
): boolean {
  return nodeEnv === "production" && PRODUCTION_DISABLED_MIGRATIONS.has(filename);
}
