import dotenv from 'dotenv';
dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
  databaseUrl: string | null;
}

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || null,
};
