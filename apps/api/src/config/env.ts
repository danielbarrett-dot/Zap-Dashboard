import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.string().url(),
  ENABLE_API_SCHEDULER: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("12h"),
  COOKIE_DOMAIN: z.string().optional().transform((value) => value || undefined),
  APP_ENCRYPTION_KEY: z.string().optional().transform((value) => value || undefined),
  SERVICEM8_SYNC_MODE: z.enum(["MOCK", "LIVE"]).default("MOCK"),
  SERVICEM8_API_BASE_URL: z.string().url().default("https://api.servicem8.com/api_1.0"),
  SERVICEM8_API_KEY: z.string().optional().transform((value) => value || undefined),
  SERVICEM8_ACCESS_TOKEN: z.string().optional().transform((value) => value || undefined),
  SERVICEM8_MATERIALS_FIELD: z.string().default("customfield_materials_cost"),
  SERVICEM8_LEAD_SOURCE_FIELD: z.string().default("customfield_lead_source"),
  SERVICEM8_JOB_TYPE_FIELD: z.string().default("customfield_job_type"),
  SERVICEM8_SUBCONTRACTOR_FIELD: z.string().default("customfield_subcontractor_cost"),
  SERVICEM8_ESTIMATED_HOURS_FIELD: z.string().default("customfield_estimated_hours"),
  SERVICEM8_ESTIMATED_MATERIALS_FIELD: z.string().default("customfield_estimated_materials"),
  QUICKBOOKS_SYNC_MODE: z.enum(["MOCK", "LIVE"]).default("MOCK"),
  QUICKBOOKS_API_BASE_URL: z.string().url().default("https://quickbooks.api.intuit.com"),
  QUICKBOOKS_TOKEN_URL: z.string().url().default("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"),
  QUICKBOOKS_CLIENT_ID: z.string().optional().transform((value) => value || undefined),
  QUICKBOOKS_CLIENT_SECRET: z.string().optional().transform((value) => value || undefined),
  QUICKBOOKS_REALM_ID: z.string().optional().transform((value) => value || undefined),
  QUICKBOOKS_REFRESH_TOKEN: z.string().optional().transform((value) => value || undefined),
  SUPPLIER_INVOICE_INBOX_MODE: z.enum(["MOCK", "IMAP", "GMAIL", "MICROSOFT_GRAPH", "SENDGRID", "MAILGUN"]).default("MOCK"),
  SUPPLIER_INVOICE_INBOX_ADDRESS: z.string().email().default("invoices@zap-dashboard.co.uk"),
  SUPPLIER_INVOICE_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.85),
  SERVICEM8_SYNC_CRON: z.string().default("*/20 * * * *"),
  QUICKBOOKS_SYNC_CRON: z.string().default("0 */2 * * *"),
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(15),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().default(10),
  PIPELINE_QUOTED_STATUSES: z.string().default("Quote,Quoted,Estimate Sent"),
  PIPELINE_ACCEPTED_STATUSES: z.string().default("Accepted,Approved,Work Order"),
  PIPELINE_COMPLETED_STATUSES: z.string().default("Completed,Job Done,Invoiced"),
  PIPELINE_CANCELLED_STATUSES: z.string().default("Cancelled,Unsuccessful")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

if (parsed.data.QUICKBOOKS_SYNC_MODE === "LIVE" && !parsed.data.APP_ENCRYPTION_KEY) {
  throw new Error("APP_ENCRYPTION_KEY is required when QUICKBOOKS_SYNC_MODE=LIVE");
}

const splitList = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  pipelineStatusGroups: {
    quoted: splitList(parsed.data.PIPELINE_QUOTED_STATUSES),
    accepted: splitList(parsed.data.PIPELINE_ACCEPTED_STATUSES),
    completed: splitList(parsed.data.PIPELINE_COMPLETED_STATUSES),
    cancelled: splitList(parsed.data.PIPELINE_CANCELLED_STATUSES)
  }
};
