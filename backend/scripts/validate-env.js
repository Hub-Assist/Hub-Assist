#!/usr/bin/env node
/**
 * Standalone environment validator.
 *
 * Loads `backend/.env` and validates the variables against the same Joi
 * schema used at app boot (`src/config/validation.schema.ts`). Designed for
 * use in CI: exits 0 on success, 1 on failure.
 *
 * Usage:
 *   node backend/scripts/validate-env.js           # validate ./backend/.env
 *   node backend/scripts/validate-env.js .env.ci   # validate a specific file
 */

const fs = require('fs');
const path = require('path');

const Joi = require('joi');

const BACKEND_DIR = path.resolve(__dirname, '..');
const targetArg = process.argv[2];
const envPath = targetArg
  ? path.resolve(process.cwd(), targetArg)
  : path.join(BACKEND_DIR, '.env');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const contents = fs.readFileSync(filePath, 'utf8');
  const result = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Treat empty assignments (`KEY=`) as unset so optional fields validate.
    if (value === '') continue;
    result[key] = value;
  }
  return result;
}

// Schema mirrors backend/src/config/validation.schema.ts. Keep these in sync.
const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  REFRESH_TOKEN_SECRET: Joi.string().required(),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().optional(),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASSWORD: Joi.string().optional(),
  EMAIL_FROM: Joi.string().optional(),
  CLOUDINARY_CLOUD_NAME: Joi.string().optional(),
  CLOUDINARY_API_KEY: Joi.string().optional(),
  CLOUDINARY_API_SECRET: Joi.string().optional(),
  STELLAR_NETWORK: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  WORKSPACE_BOOKING_CONTRACT_ID: Joi.string().optional(),
  MEMBERSHIP_TOKEN_CONTRACT_ID: Joi.string().optional(),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
}).unknown(true);

const fileVars = loadEnvFile(envPath);
const merged = { ...fileVars, ...process.env };

const { error, value } = schema.validate(merged, { abortEarly: false, allowUnknown: true });

if (error) {
  console.error(`❌ Environment validation failed (${envPath}):`);
  for (const detail of error.details) {
    console.error(`  - ${detail.message}`);
  }
  process.exit(1);
}

console.log(`✅ Environment variables validated successfully (${envPath}).`);
console.log(`   NODE_ENV=${value.NODE_ENV}  STELLAR_NETWORK=${value.STELLAR_NETWORK}`);
process.exit(0);
