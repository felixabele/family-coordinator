import { z } from 'zod';

const envSchema = z.object({
  // WhatsApp Business API
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1, 'WHATSAPP_PHONE_NUMBER_ID is required'),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1, 'WHATSAPP_ACCESS_TOKEN is required'),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1, 'WHATSAPP_WEBHOOK_VERIFY_TOKEN is required'),
  WHATSAPP_APP_SECRET: z.string().min(1, 'WHATSAPP_APP_SECRET is required'),

  // Anthropic API
  ANTHROPIC_API_KEY: z.string().startsWith('sk-', 'ANTHROPIC_API_KEY must start with sk-'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Application
  PORT: z.coerce.number().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment validation failed:');
    console.error(result.error.format());
    console.error('\nPlease check your .env file or environment variables.');
    console.error('See .env.example for required variables.\n');
    process.exit(1);
  }

  return result.data;
}
