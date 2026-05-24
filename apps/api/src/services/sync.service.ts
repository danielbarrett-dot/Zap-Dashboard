import {
  MatchStatus,
  MatchType,
  Prisma,
  SyncMode,
  SyncProvider,
  SyncRunStatus
} from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { scoreInvoiceJobMatch } from "../domain/matching.js";
import { fetchQuickBooksSyncPayload } from "./connectors/quickbooks.connector.js";
import { fetchServiceM8SyncPayload } from "./connectors/servicem8.connector.js";
import type {
  NormalizedExpenseRecord,
  NormalizedInvoiceRecord,
  NormalizedJobRecord,
  NormalizedPaymentRecord,
  NormalizedStaffRecord,
  NormalizedTimeEntryRecord
} from "./connectors/types.js";

const toDecimal = (value?: number | null) => new Prisma.Decimal((value || 0).toFixed(2));
const nullableDecimal = (value?: number | null) =>
  value === null || value === undefined ? null : new Prisma.Decimal(value.toFixed(2));
const toDate = (value?: string | null) => (value ? new Date(value) : null);
const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;

const upsertStaff = async (staff: NormalizedStaffRecord) =>
  prisma.staff.upsert({
    where: {
      serviceM8StaffId: staff.serviceM8StaffId
    },
    update: {
      name: staff.name,
      email: staff.email,
      active: staff.active,
      hourlyCostRate: nullableDecimal(staff.hourlyCostRate)
    },
    create: {
      serviceM8StaffId: staff.serviceM8StaffId,
      name: staff.name,
      email: staff.email,
      active: staff.active,
      hourlyCostRate: nullableDecimal(staff.hourlyCostRate)
    }
  });

const upsertJob = async (job: NormalizedJobRecord) =>
  prisma.job.upsert({
    where: {
      serviceM8JobId: job.serviceM8JobId
    },
    update: {
      jobName: job.jobName,
      jobNumber: job.jobNumber,
      customerName: job.customerName,
      customerId: job.customerId,
      address: job.address,
      status: job.status,
      jobDate: toDate(job.jobDate),
      completionDate: toDate(job.completionDate),
      createdAtServiceM8: toDate(job.createdAtServiceM8),
      updatedAtServiceM8: toDate(job.updatedAtServiceM8),
      leadSource: job.leadSource,
      jobType: job.jobType,
      materialsCostServiceM8: toDecimal(job.materialsCostServiceM8),
      subcontractorCost: toDecimal(job.subcontractorCost),
      estimatedHours: nullableDecimal(job.estimatedHours),
      estimatedMaterials: nullableDecimal(job.estimatedMaterials),
      quotedValue: nullableDecimal(job.quotedValue),
      totalTimeMinutes: job.totalTimeMinutes,
      serviceM8Payload: toJsonValue(job.payload)
    },
    create: {
      serviceM8JobId: job.serviceM8JobId,
      jobName: job.jobName,
      jobNumber: job.jobNumber,
      customerName: job.customerName,
      customerId: job.customerId,
      address: job.address,
      status: job.status,
      jobDate: toDate(job.jobDate),
      completionDate: toDate(job.completionDate),
      createdAtServiceM8: toDate(job.createdAtServiceM8),
      updatedAtServiceM8: toDate(job.updatedAtServiceM8),
      leadSource: job.leadSource,
      jobType: job.jobType,
      materialsCostServiceM8: toDecimal(job.materialsCostServiceM8),
      subcontractorCost: toDecimal(job.subcontractorCost),
      estimatedHours: nullableDecimal(job.estimatedHours),
      estimatedMaterials: nullableDecimal(job.estimatedMaterials),
      quotedValue: nullableDecimal(job.quotedValue),
      totalTimeMinutes: job.totalTimeMinutes,
      serviceM8Payload: toJsonValue(job.payload)
    }
  });

const upsertTimeEntry = async (entry: NormalizedTimeEntryRecord, jobIdByServiceM8Id: Map<string, string>) => {
  const jobId = jobIdByServiceM8Id.get(entry.jobServiceM8JobId);

  if (!jobId) {
    return;
  }

  await prisma.timeEntry.upsert({
    where: {
      serviceM8BookingId: entry.serviceM8BookingId
    },
    update: {
      jobId,
      staffId: entry.staffId,
      staffName: entry.staffName,
      startTime: toDate(entry.startTime),
      endTime: toDate(entry.endTime),
      durationMinutes: entry.durationMinutes
    },
    create: {
      serviceM8BookingId: entry.serviceM8BookingId,
      jobId,
      staffId: entry.staffId,
      staffName: entry.staffName,
      startTime: toDate(entry.startTime),
      endTime: toDate(entry.endTime),
      durationMinutes: entry.durationMinutes
    }
  });
};

const recomputeJobTimeTotals = async () => {
  const grouped = await prisma.timeEntry.groupBy({
    by: ["jobId"],
    _sum: {
      durationMinutes: true
    }
  });

  await Promise.all(
    grouped.map((row) =>
      prisma.job.update({
        where: {
          id: row.jobId
        },
        data: {
          totalTimeMinutes: row._sum.durationMinutes || 0
        }
      })
    )
  );
};

const upsertInvoice = async (invoice: NormalizedInvoiceRecord) =>
  prisma.invoice.upsert({
    where: {
      quickBooksInvoiceId: invoice.quickBooksInvoiceId
    },
    update: {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerId: invoice.customerId,
      invoiceDate: new Date(invoice.invoiceDate),
      dueDate: toDate(invoice.dueDate),
      totalExVat: toDecimal(invoice.totalExVat),
      vatAmount: toDecimal(invoice.vatAmount),
      totalIncVat: toDecimal(invoice.totalIncVat),
      balanceDue: toDecimal(invoice.balanceDue),
      paymentStatus: invoice.paymentStatus,
      reference: invoice.reference,
      memo: invoice.memo,
      createdAtQuickBooks: toDate(invoice.createdAtQuickBooks),
      updatedAtQuickBooks: toDate(invoice.updatedAtQuickBooks),
      quickBooksPayload: toJsonValue(invoice.payload)
    },
    create: {
      quickBooksInvoiceId: invoice.quickBooksInvoiceId,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerId: invoice.customerId,
      invoiceDate: new Date(invoice.invoiceDate),
      dueDate: toDate(invoice.dueDate),
      totalExVat: toDecimal(invoice.totalExVat),
      vatAmount: toDecimal(invoice.vatAmount),
      totalIncVat: toDecimal(invoice.totalIncVat),
      balanceDue: toDecimal(invoice.balanceDue),
      paymentStatus: invoice.paymentStatus,
      reference: invoice.reference,
      memo: invoice.memo,
      createdAtQuickBooks: toDate(invoice.createdAtQuickBooks),
      updatedAtQuickBooks: toDate(invoice.updatedAtQuickBooks),
      quickBooksPayload: toJsonValue(invoice.payload)
    }
  });

const upsertPayment = async (payment: NormalizedPaymentRecord, invoiceIdByQuickBooksId: Map<string, string>) => {
  const invoiceId = payment.invoiceQuickBooksInvoiceId
    ? invoiceIdByQuickBooksId.get(payment.invoiceQuickBooksInvoiceId)
    : undefined;

  await prisma.payment.upsert({
    where: {
      quickBooksPaymentId: payment.quickBooksPaymentId
    },
    update: {
      invoiceId,
      paymentDate: new Date(payment.paymentDate),
      amount: toDecimal(payment.amount),
      paymentMethod: payment.paymentMethod
    },
    create: {
      quickBooksPaymentId: payment.quickBooksPaymentId,
      invoiceId,
      paymentDate: new Date(payment.paymentDate),
      amount: toDecimal(payment.amount),
      paymentMethod: payment.paymentMethod
    }
  });
};

const upsertExpense = async (expense: NormalizedExpenseRecord, jobIdByServiceM8Id: Map<string, string>) => {
  const linkedJobId = expense.linkedServiceM8JobId
    ? jobIdByServiceM8Id.get(expense.linkedServiceM8JobId)
    : undefined;

  await prisma.expense.upsert({
    where: {
      quickBooksExpenseId: expense.quickBooksExpenseId
    },
    update: {
      supplierName: expense.supplierName,
      expenseDate: new Date(expense.expenseDate),
      accountName: expense.accountName,
      accountType: expense.accountType,
      category: expense.category,
      dashboardCategory: expense.dashboardCategory,
      description: expense.description,
      amountExVat: toDecimal(expense.amountExVat),
      vatAmount: toDecimal(expense.vatAmount),
      amountIncVat: toDecimal(expense.amountIncVat),
      paymentStatus: expense.paymentStatus,
      reference: expense.reference,
      linkedCustomerName: expense.linkedCustomerName,
      linkedJobId,
      createdAtQuickBooks: toDate(expense.createdAtQuickBooks),
      updatedAtQuickBooks: toDate(expense.updatedAtQuickBooks),
      quickBooksPayload: toJsonValue(expense.payload)
    },
    create: {
      quickBooksExpenseId: expense.quickBooksExpenseId,
      supplierName: expense.supplierName,
      expenseDate: new Date(expense.expenseDate),
      accountName: expense.accountName,
      accountType: expense.accountType,
      category: expense.category,
      dashboardCategory: expense.dashboardCategory,
      description: expense.description,
      amountExVat: toDecimal(expense.amountExVat),
      vatAmount: toDecimal(expense.vatAmount),
      amountIncVat: toDecimal(expense.amountIncVat),
      paymentStatus: expense.paymentStatus,
      reference: expense.reference,
      linkedCustomerName: expense.linkedCustomerName,
      linkedJobId,
      createdAtQuickBooks: toDate(expense.createdAtQuickBooks),
      updatedAtQuickBooks: toDate(expense.updatedAtQuickBooks),
      quickBooksPayload: toJsonValue(expense.payload)
    }
  });
};

const asNumber = (value: Prisma.Decimal | number | null | undefined) => Number(value || 0);

export const autoMatchInvoices = async () => {
  const [jobs, invoices, lockedMatches] = await Promise.all([
    prisma.job.findMany({
      select: {
        id: true,
        jobName: true,
        jobNumber: true,
        customerName: true,
        jobDate: true,
        completionDate: true,
        quotedValue: true
      }
    }),
    prisma.invoice.findMany({
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        reference: true,
        memo: true,
        invoiceDate: true,
        totalExVat: true
      }
    }),
    prisma.jobInvoiceMatch.findMany({
      where: {
        OR: [
          { status: MatchStatus.MANUALLY_CONFIRMED },
          { matchType: MatchType.MANUAL },
          { matchType: MatchType.SPLIT },
          { matchType: MatchType.IGNORED }
        ]
      },
      select: {
        invoiceId: true
      }
    })
  ]);

  const lockedInvoiceIds = new Set(lockedMatches.map((match) => match.invoiceId));
  let createdOrUpdated = 0;

  for (const invoice of invoices) {
    if (lockedInvoiceIds.has(invoice.id)) {
      continue;
    }

    const candidates = jobs
      .map((job) => ({
        job,
        score: scoreInvoiceJobMatch(
          {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName,
            invoiceDate: invoice.invoiceDate,
            totalExVat: asNumber(invoice.totalExVat),
            reference: invoice.reference,
            memo: invoice.memo
          },
          {
            id: job.id,
            jobName: job.jobName,
            jobNumber: job.jobNumber,
            customerName: job.customerName,
            jobDate: job.jobDate,
            completionDate: job.completionDate,
            quotedValue: asNumber(job.quotedValue)
          }
        )
      }))
      .filter(({ score }) => score.status !== "UNMATCHED")
      .sort((left, right) => right.score.confidenceScore - left.score.confidenceScore);

    if (candidates.length === 0) {
      continue;
    }

    const best = candidates[0];
    const status =
      best.score.status === "MATCHED" ? MatchStatus.MATCHED : MatchStatus.POSSIBLE_MATCH;

    await prisma.jobInvoiceMatch.updateMany({
      where: {
        invoiceId: invoice.id,
        jobId: {
          not: best.job.id
        },
        status: {
          in: [MatchStatus.MATCHED, MatchStatus.POSSIBLE_MATCH]
        },
        matchType: {
          in: [MatchType.AUTO_JOB_REFERENCE, MatchType.AUTO_CUSTOMER_NAME, MatchType.FUZZY_MATCH]
        }
      },
      data: {
        status: MatchStatus.IGNORED,
        notes: "Superseded by a newer automatic match candidate"
      }
    });

    await prisma.jobInvoiceMatch.upsert({
      where: {
        jobId_invoiceId: {
          jobId: best.job.id,
          invoiceId: invoice.id
        }
      },
      update: {
        matchType: MatchType[best.score.matchType],
        confidenceScore: best.score.confidenceScore,
        status,
        notes: best.score.reasons.join("; ")
      },
      create: {
        jobId: best.job.id,
        invoiceId: invoice.id,
        matchType: MatchType[best.score.matchType],
        confidenceScore: best.score.confidenceScore,
        status,
        notes: best.score.reasons.join("; ")
      }
    });

    createdOrUpdated += 1;
  }

  return createdOrUpdated;
};

const createSyncLog = async (source: SyncProvider, triggeredByUserId?: string) =>
  prisma.syncLog.create({
    data: {
      source,
      status: SyncRunStatus.RUNNING,
      triggeredByUserId
    }
  });

const finishSyncLog = async (
  syncLogId: string,
  status: SyncRunStatus,
  details: Record<string, unknown>,
  recordsCreated: number,
  recordsUpdated: number,
  errorMessage?: string
) =>
  prisma.syncLog.update({
    where: {
      id: syncLogId
    },
    data: {
      status,
      details: toJsonValue(details),
      recordsCreated,
      recordsUpdated,
      errorMessage,
      completedAt: new Date()
    }
  });

const upsertConnectionStatus = async (source: SyncProvider, status: string, errorMessage?: string) =>
  prisma.integrationConnection.upsert({
    where: {
      provider: source
    },
    update: {
      mode:
        source === SyncProvider.SERVICEM8
          ? env.SERVICEM8_SYNC_MODE === "LIVE"
            ? SyncMode.LIVE
            : SyncMode.MOCK
          : source === SyncProvider.QUICKBOOKS
            ? env.QUICKBOOKS_SYNC_MODE === "LIVE"
              ? SyncMode.LIVE
              : SyncMode.MOCK
            : SyncMode.MOCK,
      status,
      lastSuccessfulSyncAt: status === "CONNECTED" ? new Date() : undefined,
      lastAttemptAt: new Date(),
      lastError: errorMessage || null
    },
    create: {
      provider: source,
      mode:
        source === SyncProvider.SERVICEM8
          ? env.SERVICEM8_SYNC_MODE === "LIVE"
            ? SyncMode.LIVE
            : SyncMode.MOCK
          : source === SyncProvider.QUICKBOOKS
            ? env.QUICKBOOKS_SYNC_MODE === "LIVE"
              ? SyncMode.LIVE
              : SyncMode.MOCK
            : SyncMode.MOCK,
      status,
      lastSuccessfulSyncAt: status === "CONNECTED" ? new Date() : null,
      lastAttemptAt: new Date(),
      lastError: errorMessage || null
    }
  });

const syncServiceM8 = async () => {
  const payload = await fetchServiceM8SyncPayload();
  const staff = await Promise.all(payload.staff.map(upsertStaff));
  const jobs = await Promise.all(payload.jobs.map(upsertJob));
  const jobIdByServiceM8Id = new Map(jobs.map((job) => [job.serviceM8JobId || "", job.id]));

  await Promise.all(payload.timeEntries.map((entry) => upsertTimeEntry(entry, jobIdByServiceM8Id)));
  await recomputeJobTimeTotals();
  await upsertConnectionStatus(SyncProvider.SERVICEM8, "CONNECTED");

  return {
    jobs: payload.jobs.length,
    timeEntries: payload.timeEntries.length,
    staff: staff.length
  };
};

const syncQuickBooks = async () => {
  const payload = await fetchQuickBooksSyncPayload();
  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      serviceM8JobId: true
    }
  });
  const jobIdByServiceM8Id = new Map(jobs.map((job) => [job.serviceM8JobId || "", job.id]));
  const invoices = await Promise.all(payload.invoices.map(upsertInvoice));
  const invoiceIdByQuickBooksId = new Map(invoices.map((invoice) => [invoice.quickBooksInvoiceId || "", invoice.id]));

  await Promise.all(payload.payments.map((payment) => upsertPayment(payment, invoiceIdByQuickBooksId)));
  await Promise.all(payload.expenses.map((expense) => upsertExpense(expense, jobIdByServiceM8Id)));
  await upsertConnectionStatus(SyncProvider.QUICKBOOKS, "CONNECTED");

  return {
    invoices: payload.invoices.length,
    payments: payload.payments.length,
    expenses: payload.expenses.length
  };
};

export const syncProvider = async (source: SyncProvider, triggeredByUserId?: string) => {
  const syncLog = await createSyncLog(source, triggeredByUserId);

  try {
    const details =
      source === SyncProvider.SERVICEM8
        ? await syncServiceM8()
        : source === SyncProvider.QUICKBOOKS
          ? await syncQuickBooks()
          : { supplierInbox: 0 };

    const autoMatchedCount = source === SyncProvider.QUICKBOOKS ? await autoMatchInvoices() : 0;
    const recordsSynced = Object.values(details).reduce((total, value) => total + Number(value), 0);

    await finishSyncLog(
      syncLog.id,
      SyncRunStatus.SUCCESS,
      {
        ...details,
        autoMatchedCount
      },
      recordsSynced,
      0
    );

    return {
      source,
      ...details,
      autoMatchedCount
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown sync error";

    await upsertConnectionStatus(source, "ERROR", errorMessage);
    await finishSyncLog(syncLog.id, SyncRunStatus.FAILED, {}, 0, 0, errorMessage);
    throw error;
  }
};

export const syncAllProviders = async (triggeredByUserId?: string) => {
  const servicem8 = await syncProvider(SyncProvider.SERVICEM8, triggeredByUserId);
  const quickbooks = await syncProvider(SyncProvider.QUICKBOOKS, triggeredByUserId);

  return {
    servicem8,
    quickbooks
  };
};

export const runLoginTriggeredSyncCheck = async () => {
  const [serviceM8Connection, quickBooksConnection] = await Promise.all([
    prisma.integrationConnection.findUnique({ where: { provider: SyncProvider.SERVICEM8 } }),
    prisma.integrationConnection.findUnique({ where: { provider: SyncProvider.QUICKBOOKS } })
  ]);
  const now = Date.now();
  const serviceM8Stale =
    !serviceM8Connection?.lastSuccessfulSyncAt ||
    now - serviceM8Connection.lastSuccessfulSyncAt.getTime() > 15 * 60 * 1000;
  const quickBooksStale =
    !quickBooksConnection?.lastSuccessfulSyncAt ||
    now - quickBooksConnection.lastSuccessfulSyncAt.getTime() > 60 * 60 * 1000;

  if (serviceM8Stale) {
    void syncProvider(SyncProvider.SERVICEM8).catch(() => undefined);
  }

  if (quickBooksStale) {
    void syncProvider(SyncProvider.QUICKBOOKS).catch(() => undefined);
  }
};

export const createManualMatch = async (input: {
  jobId: string;
  invoiceId: string;
  userId: string;
  notes?: string;
  split?: boolean;
}) => {
  if (!input.split) {
    await prisma.jobInvoiceMatch.updateMany({
      where: {
        invoiceId: input.invoiceId,
        jobId: {
          not: input.jobId
        },
        status: {
          in: [MatchStatus.MATCHED, MatchStatus.POSSIBLE_MATCH]
        },
        matchType: {
          in: [MatchType.AUTO_JOB_REFERENCE, MatchType.AUTO_CUSTOMER_NAME, MatchType.FUZZY_MATCH]
        }
      },
      data: {
        status: MatchStatus.IGNORED,
        notes: "Superseded by manual match"
      }
    });
  }

  return prisma.jobInvoiceMatch.upsert({
    where: {
      jobId_invoiceId: {
        jobId: input.jobId,
        invoiceId: input.invoiceId
      }
    },
    update: {
      matchType: input.split ? MatchType.SPLIT : MatchType.MANUAL,
      status: MatchStatus.MANUALLY_CONFIRMED,
      confidenceScore: 1,
      manuallyConfirmedByUserId: input.userId,
      notes: input.notes
    },
    create: {
      jobId: input.jobId,
      invoiceId: input.invoiceId,
      matchType: input.split ? MatchType.SPLIT : MatchType.MANUAL,
      status: MatchStatus.MANUALLY_CONFIRMED,
      confidenceScore: 1,
      manuallyConfirmedByUserId: input.userId,
      notes: input.notes
    }
  });
};

export const removeMatch = async (matchId: string) =>
  prisma.jobInvoiceMatch.update({
    where: {
      id: matchId
    },
    data: {
      status: MatchStatus.IGNORED,
      matchType: MatchType.IGNORED
    }
  });
