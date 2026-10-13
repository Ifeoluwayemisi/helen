import dotenv from "dotenv";
dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
  databaseUrl: string | null;
  cookieSecret: string;
  corsOrigins: string[];
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const cookieSecret =
  process.env.COOKIE_SECRET ||
  (isProduction ? "" : "local-development-cookie-secret-not-for-production");
if (isProduction && cookieSecret.length < 32) {
  throw new Error(
    "COOKIE_SECRET must be configured with at least 32 characters in production.",
  );
}

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (isProduction && configuredOrigins.length === 0) {
  throw new Error(
    "CORS_ORIGINS must list trusted frontend origins in production.",
  );
}
for (const origin of configuredOrigins) {
  const parsed = new URL(origin);
  if (
    parsed.origin !== origin ||
    (isProduction && parsed.protocol !== "https:")
  ) {
    throw new Error(
      "CORS_ORIGINS entries must be exact origins; production origins must use HTTPS.",
    );
  }
}

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || "3001", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL || null,
  cookieSecret,
  corsOrigins: isProduction
    ? configuredOrigins
    : configuredOrigins.length > 0
      ? configuredOrigins
      : ["http://localhost:3000", "http://127.0.0.1:3000"],
};
