import { z } from 'zod';

const envSchema = z.object({
  // Signal messaging
  SIGNAL_PHONE_NUMBER: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format (e.g., +12025551234)'),

  // Anthropic API
  ANTHROPIC_API_KEY: z.string().startsWith('sk-', 'ANTHROPIC_API_KEY must start with sk-'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Application
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
