# Zap Electrical Internal Business Dashboard

Production-ready Phase 1 foundation for Zap Electrical’s internal dashboard. The app syncs ServiceM8, QuickBooks, staff time, supplier invoices, material allocations, job profitability, pipeline, P&L, and audit data into PostgreSQL so dashboards never depend on live third-party API calls.

## What Is Included

- Express API, Prisma ORM, PostgreSQL
- Next.js, React, Tailwind CSS, Recharts
- Secure email/password login with bcrypt, JWT http-only cookies, rate limiting, optional TOTP 2FA
- Roles: Admin, Manager, Read Only, Staff
- Per-user permissions for non-admin access levels
- ServiceM8 sync structure for jobs, staff, diary time, and custom fields
- QuickBooks sync structure for invoices, payments, expenses, purchases, bills, and P&L categories
- Supplier invoice inbox/review workflow with allocation, amendment, duplicate, failed-read, and needs-review states
- Job/invoice reconciliation with automatic, possible, manual, split, ignored, and confirmed match statuses
- Audit logs and manual override records
- Mock mode and seed data for local use without live credentials
- Tests for calculations, matching, supplier invoice validation, duplicate checks, and access-control rules

## Apps

```text
apps/
  api/   Express API, Prisma schema, sync workers, domain logic, seed data
  web/   Next.js internal dashboard
```

## Core Rules

- Profitability uses ex VAT values only.
- ServiceM8 and QuickBooks data is synced into PostgreSQL; dashboard pages read from the local database.
- Supplier invoices do not affect job costing unless included and assigned/partially assigned/manually corrected.
- Failed, ignored, removed, needs-review, possible-duplicate, and unassigned supplier invoices are excluded from job costing.
- Manual matches, corrections, allocations, removals, and overrides are audit logged.
- Missing, estimated, low-confidence, manually amended, or uncertain data is shown as warnings.
- Completed-job reporting uses `completionDate`; pipeline uses `jobDate`; P&L uses QuickBooks transaction dates.

## Local Setup

1. Start PostgreSQL:

```bash
docker compose up -d db
```

2. Install dependencies from the repo root:

```bash
npm install
```

3. Create env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

4. Generate Prisma client, apply migrations, and seed mock data:

```bash
npm run prisma:generate --workspace apps/api
npm run db:migrate
npm run db:seed
```

5. Start both apps:

```bash
npm run dev
```

Frontend: `http://localhost:3000`  
API: `http://localhost:4000`

## Seeded Users

- Admin: `admin@zap-electrical.co.uk` / `AdminPass123!`
- Manager: `manager@zap-electrical.co.uk` / `ManagerPass123!`
- Read Only: `readonly@zap-electrical.co.uk` / `ReadOnlyPass123!`
- Staff: `staff@zap-electrical.co.uk` / `StaffPass123!`

Replace these immediately before any real deployment.

## Main Pages

- Overview dashboard
- Jobs table and job detail
- QuickBooks reconciliation
- Supplier invoices
- Marketing / lead sources
- Job types
- Pipeline
- P&L
- Staff
- Admin/settings

## ServiceM8 Configuration

Set `SERVICEM8_SYNC_MODE=LIVE` and provide either `SERVICEM8_API_KEY` or `SERVICEM8_ACCESS_TOKEN`.

Map custom fields with:

- `SERVICEM8_MATERIALS_FIELD`
- `SERVICEM8_LEAD_SOURCE_FIELD`
- `SERVICEM8_JOB_TYPE_FIELD`
- `SERVICEM8_SUBCONTRACTOR_FIELD`
- `SERVICEM8_ESTIMATED_HOURS_FIELD`
- `SERVICEM8_ESTIMATED_MATERIALS_FIELD`

The raw ServiceM8 payload is stored on each job so Admin can refine field mappings without losing source evidence.

## QuickBooks Configuration

Set `QUICKBOOKS_SYNC_MODE=LIVE` and provide:

- `QUICKBOOKS_CLIENT_ID`
- `QUICKBOOKS_CLIENT_SECRET`
- `QUICKBOOKS_REALM_ID`
- `QUICKBOOKS_REFRESH_TOKEN`
- `APP_ENCRYPTION_KEY`

QuickBooks tokens are stored encrypted. Admin can map QuickBooks accounts into dashboard P&L categories in settings.

## Supplier Invoice Inbox

Phase 1 includes the database, workflow, review states, duplicate detection, allocation logic, and mock inbox data. It is ready to connect to an inbound email provider using:

- IMAP
- Gmail API
- Microsoft Graph
- SendGrid Inbound Parse
- Mailgun Inbound Routing

Configure:

- `SUPPLIER_INVOICE_INBOX_MODE`
- `SUPPLIER_INVOICE_INBOX_ADDRESS`
- `SUPPLIER_INVOICE_CONFIDENCE_THRESHOLD`

Forwarding target in the sample config: `invoices@zap-dashboard.co.uk`.

## Material Cost Source Rules

Supported rules:

- approved supplier invoices, then ServiceM8 fallback
- supplier invoices only
- ServiceM8 manual materials only
- supplier invoices plus manual adjustment
- manual dashboard override
- higher of supplier invoices or ServiceM8
- exclude temporarily

The job detail page shows supplier invoice materials, ServiceM8 manual materials, manual adjustments, overrides, and warnings separately.

## Tests

```bash
npm run test --workspace apps/api
```

Coverage includes profit calculations, divide-by-zero handling, material source rules, invoice/job matching confidence, supplier invoice review logic, duplicate detection, and role/permission restrictions.

## Deployment Notes

API target: Render  
Database target: Render PostgreSQL or Supabase PostgreSQL  
Frontend target: Vercel or Render

The included `render.yaml` defines:

- `zap-electrical-db`: PostgreSQL database
- `zap-electrical-api`: Express API web service
- `zap-electrical-web`: Next.js frontend service
- `zap-electrical-sync-worker`: separate scheduler/worker service for ServiceM8 and QuickBooks sync jobs

In local development the API starts the scheduler by default. In Render, `ENABLE_API_SCHEDULER=false` is set on the API service so only the worker runs scheduled syncs.

Production checklist:

- Use HTTPS for both frontend and API.
- Set `FRONTEND_URL` to the deployed frontend origin.
- Set `NEXT_PUBLIC_API_URL` to the deployed API `/api` URL.
- Set a strong `JWT_SECRET`.
- Set `APP_ENCRYPTION_KEY` before live QuickBooks sync.
- Restrict CORS to the frontend URL.
- Replace seeded users.
- Review Read Only and Manager permissions.
- Confirm ServiceM8 custom fields and QuickBooks category mappings.
- Configure supplier invoice email ingestion.
- Back up PostgreSQL.
- Monitor sync logs and supplier invoices needing review.

## Render Environment Variables

API and worker services:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=<from Render Postgres>
FRONTEND_URL=https://<your-web-service>.onrender.com
ENABLE_API_SCHEDULER=false
JWT_SECRET=<strong random secret>
JWT_EXPIRES_IN=12h
COOKIE_DOMAIN=
APP_ENCRYPTION_KEY=<base64-encoded 32-byte key, required before QuickBooks LIVE>

SERVICEM8_SYNC_MODE=MOCK
SERVICEM8_API_BASE_URL=https://api.servicem8.com/api_1.0
SERVICEM8_API_KEY=
SERVICEM8_ACCESS_TOKEN=
SERVICEM8_MATERIALS_FIELD=customfield_materials_cost
SERVICEM8_LEAD_SOURCE_FIELD=customfield_lead_source
SERVICEM8_JOB_TYPE_FIELD=customfield_job_type
SERVICEM8_SUBCONTRACTOR_FIELD=customfield_subcontractor_cost
SERVICEM8_ESTIMATED_HOURS_FIELD=customfield_estimated_hours
SERVICEM8_ESTIMATED_MATERIALS_FIELD=customfield_estimated_materials

QUICKBOOKS_SYNC_MODE=MOCK
QUICKBOOKS_API_BASE_URL=https://quickbooks.api.intuit.com
QUICKBOOKS_TOKEN_URL=https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REALM_ID=
QUICKBOOKS_REFRESH_TOKEN=

SUPPLIER_INVOICE_INBOX_MODE=MOCK
SUPPLIER_INVOICE_INBOX_ADDRESS=invoices@zap-dashboard.co.uk
SUPPLIER_INVOICE_CONFIDENCE_THRESHOLD=0.85

SERVICEM8_SYNC_CRON=*/20 * * * *
QUICKBOOKS_SYNC_CRON=0 */2 * * *
LOGIN_RATE_LIMIT_WINDOW_MINUTES=15
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=10

PIPELINE_QUOTED_STATUSES=Quote,Quoted,Estimate Sent
PIPELINE_ACCEPTED_STATUSES=Accepted,Approved,Work Order
PIPELINE_COMPLETED_STATUSES=Completed,Job Done,Invoiced
PIPELINE_CANCELLED_STATUSES=Cancelled,Unsuccessful
```

Web service:

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://<your-api-service>.onrender.com/api
```

Keep all integration modes as `MOCK` until live QuickBooks, ServiceM8, and supplier email ingestion are deliberately enabled and tested.

## Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run test
npm run db:up
npm run db:migrate
npm run db:seed
npm run sync:sample
```
