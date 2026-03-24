import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { AppConfig, ApiType, PricingConfig } from './types';

dotenv.config();

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.error(`[token-zip] Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export function loadAppConfig(): AppConfig {
  return {
    port: parseInt(optionalEnv('PORT', '3000'), 10),
    compress: {
      apiType: optionalEnv('COMPRESS_API_TYPE', 'openai') as ApiType,
      model: requireEnv('COMPRESS_MODEL'),
      apiKey: requireEnv('COMPRESS_API_KEY'),
      baseUrl: requireEnv('COMPRESS_BASE_URL'),
    },
    target: {
      apiType: optionalEnv('TARGET_API_TYPE', 'anthropic') as ApiType,
      model: requireEnv('TARGET_MODEL'),
      apiKey: requireEnv('TARGET_API_KEY'),
      baseUrl: optionalEnv('TARGET_BASE_URL', ''),
    },
    usdCnyRate: parseFloat(optionalEnv('USD_CNY_RATE', '7.25')),
    logLevel: optionalEnv('LOG_LEVEL', 'info'),
  };
}

export function loadPricingConfig(): PricingConfig {
  const pricingPath = path.resolve(__dirname, '../config/pricing.json');
  if (!fs.existsSync(pricingPath)) {
    console.warn('[token-zip] pricing.json not found, cost calculation will be disabled');
    return { exchangeRates: { USD_CNY: 7.25 }, models: {} };
  }
  return JSON.parse(fs.readFileSync(pricingPath, 'utf-8'));
}
