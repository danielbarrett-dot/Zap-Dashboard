import {
  MatchStatus,
  SupplierInvoiceStatus,
  type MaterialCostSource,
  type Prisma
} from "@prisma/client";

import { prisma } from "../config/prisma.js";
import { PIPELINE_STATUS_GROUPS } from "../constants/pipeline.js";
import { calculateJobProfitability, roundCurrency, safeDivide } from "../domain/calculations.js";
import { toCurrencyNumber } from "../utils/number.js";

type UserRole = "ADMIN" | "MANAGER" | "READ_ONLY" | "STAFF";

type JobFilters = {
  from?: Date;
  to?: Date;
  leadSource?: string;
  jobType?: string;
  customer?: string;
  jobStatus?: string;
  matchStatus?: string;
  missingMaterials?: boolean;
  missingTime?: boolean;
  materialCostSource?: MaterialCostSource;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const formatMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const normalizeStatus = (value: string) => value.trim().toLowerCase();
const completedStatusSet = new Set(PIPELINE_STATUS_GROUPS.completed.map(normalizeStatus));
const quotedStatusSet = new Set(PIPELINE_STATUS_GROUPS.quoted.map(normalizeStatus));
const acceptedStatusSet = new Set(PIPELINE_STATUS_GROUPS.accepted.map(normalizeStatus));
const cancelledStatusSet = new Set(PIPELINE_STATUS_GROUPS.cancelled.map(normalizeStatus));
const isCompletedStatus = (status: string) => completedStatusSet.has(normalizeStatus(status));
const isAcceptedStatus = (status: string) => acceptedStatusSet.has(normalizeStatus(status));
const isQuotedStatus = (status: string) => quotedStatusSet.has(normalizeStatus(status));
const isCancelledStatus = (status: string) => cancelledStatusSet.has(normalizeStatus(status));
const isFinancialRole = (role: UserRole) => role !== "STAFF";

const includedSupplierStatuses = new Set<SupplierInvoiceStatus>([
  SupplierInvoiceStatus.ASSIGNED,
  SupplierInvoiceStatus.PARTIALLY_ASSIGNED,
  SupplierInvoiceStatus.MANUALLY_CORRECTED
]);
const confirmedInvoiceMatchStatuses = new Set<MatchStatus>([
  MatchStatus.MATCHED,
  MatchStatus.MANUALLY_CONFIRMED
]);

const dateRangeWhere = (fieldName: "jobDate" | "completionDate" | "invoiceDate" | "expenseDate", from?: Date, to?: Date) =>
  from || to
    ? {
        [fieldName]: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {})
        }
      }
    : {};

const completedJobRangeWhere = (from?: Date, to?: Date): Prisma.JobWhereInput =>
  from || to
    ? {
        OR: [
          {
            completionDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {})
            }
          },
          {
            completionDate: null,
            jobDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {})
            }
          }
        ]
      }
    : {};

const getJobWhere = (filters: JobFilters): Prisma.JobWhereInput => ({
  ...completedJobRangeWhere(filters.from, filters.to),
  ...(filters.leadSource ? { leadSource: filters.leadSource } : {}),
  ...(filters.jobType ? { jobType: filters.jobType } : {}),
  ...(filters.customer
    ? {
        customerName: {
          contains: filters.customer,
          mode: "insensitive"
        }
      }
    : {}),
  ...(filters.jobStatus ? { status: filters.jobStatus } : {}),
  ...(filters.materialCostSource ? { materialCostSource: filters.materialCostSource } : {})
});

const getStaffRateMaps = async () => {
  const staff = await prisma.staff.findMany();

  return {
    byId: new Map(staff.map((row) => [row.serviceM8StaffId || "", toCurrencyNumber(row.hourlyCostRate)])),
    byName: new Map(staff.map((row) => [row.name, toCurrencyNumber(row.hourlyCostRate)]))
  };
};

const calculateLabourCost = (
  entries: Array<{ staffId: string | null; staffName: string; durationMinutes: number }>,
  rates: Awaited<ReturnType<typeof getStaffRateMaps>>
) => {
  if (entries.length === 0) {
    return {
      labourCost: null,
      missingRates: []
    };
  }

  const missingRates = new Set<string>();
  let total = 0;

  for (const entry of entries) {
    const rate = (entry.staffId ? rates.byId.get(entry.staffId) : undefined) ?? rates.byName.get(entry.staffName);

    if (!rate) {
      missingRates.add(entry.staffName);
      continue;
    }

    total += (entry.durationMinutes / 60) * rate;
  }

  return {
    labourCost: missingRates.size > 0 ? null : roundCurrency(total),
    missingRates: Array.from(missingRates)
  };
};

const serializeSupplierAllocation = (allocation: Prisma.SupplierInvoiceAllocationGetPayload<{ include: { supplierInvoice: true } }>) => ({
  id: allocation.id,
  supplierInvoiceId: allocation.supplierInvoiceId,
  supplierName: allocation.supplierInvoice.supplierName,
  invoiceNumber: allocation.supplierInvoice.invoiceNumber,
  invoiceDate: allocation.supplierInvoice.invoiceDate?.toISOString() ?? null,
  status: allocation.supplierInvoice.extractionStatus,
  amountExVat: toCurrencyNumber(allocation.amountExVat),
  allocationType: allocation.allocationType,
  notes: allocation.notes,
  includedInCosting: allocation.supplierInvoice.isIncludedInJobCosting
});

const toJobPerformance = (
  job: Prisma.JobGetPayload<{
    include: {
      invoiceMatches: { include: { invoice: true } };
      timeEntries: true;
      supplierAllocations: { include: { supplierInvoice: true } };
    };
  }>,
  rates: Awaited<ReturnType<typeof getStaffRateMaps>>
) => {
  const confirmedMatches = job.invoiceMatches.filter((match) => confirmedInvoiceMatchStatuses.has(match.status));
  const possibleMatches = job.invoiceMatches.filter((match) => match.status === MatchStatus.POSSIBLE_MATCH);
  const revenueExVat = roundCurrency(
    confirmedMatches.reduce((total, match) => total + toCurrencyNumber(match.invoice.totalExVat), 0)
  );
  const approvedSupplierMaterials = roundCurrency(
    job.supplierAllocations
      .filter(
        (allocation) =>
          allocation.supplierInvoice.isIncludedInJobCosting &&
          includedSupplierStatuses.has(allocation.supplierInvoice.extractionStatus)
      )
      .reduce((total, allocation) => total + toCurrencyNumber(allocation.amountExVat), 0)
  );
  const { labourCost, missingRates } = calculateLabourCost(job.timeEntries, rates);
  const profitability = calculateJobProfitability({
    revenueExVat,
    approvedSupplierMaterials,
    serviceM8Materials: toCurrencyNumber(job.materialsCostServiceM8),
    manualMaterialAdjustment: toCurrencyNumber(job.manualMaterialAdjustment),
    manualMaterialOverride: job.manualMaterialOverride === null ? null : toCurrencyNumber(job.manualMaterialOverride),
    materialCostSource: job.materialCostSource,
    subcontractorCost: toCurrencyNumber(job.subcontractorCost),
    labourMinutes: job.totalTimeMinutes,
    labourCost,
    quotedValue: job.quotedValue === null ? null : toCurrencyNumber(job.quotedValue),
    estimatedHours: job.estimatedHours === null ? null : toCurrencyNumber(job.estimatedHours),
    estimatedMaterials: job.estimatedMaterials === null ? null : toCurrencyNumber(job.estimatedMaterials)
  });
  const warnings = [
    ...(confirmedMatches.length === 0 ? ["No confirmed QuickBooks invoice match"] : []),
    ...(possibleMatches.length > 0 ? ["Possible QuickBooks invoice match needs review"] : []),
    ...profitability.materialWarnings,
    ...(job.totalTimeMinutes === 0 ? ["No labour time logged"] : []),
    ...(missingRates.length > 0 ? [`Missing labour cost rate for ${missingRates.join(", ")}`] : []),
    ...(job.completionDate === null && isCompletedStatus(job.status) ? ["Missing completion date"] : []),
    ...(job.estimatedHours === null ? ["Missing estimated hours"] : []),
    ...(job.estimatedMaterials === null ? ["Missing estimated materials"] : []),
    ...(job.manualMaterialOverride !== null ? ["Manual material override applied"] : [])
  ];

  return {
    id: job.id,
    serviceM8JobId: job.serviceM8JobId,
    jobName: job.jobName,
    jobNumber: job.jobNumber,
    customerName: job.customerName,
    customerId: job.customerId,
    address: job.address,
    status: job.status,
    jobDate: job.jobDate?.toISOString() ?? null,
    completionDate: job.completionDate?.toISOString() ?? null,
    leadSource: job.leadSource,
    jobType: job.jobType,
    quotedValue: job.quotedValue === null ? null : toCurrencyNumber(job.quotedValue),
    estimatedHours: job.estimatedHours === null ? null : toCurrencyNumber(job.estimatedHours),
    estimatedMaterials: job.estimatedMaterials === null ? null : toCurrencyNumber(job.estimatedMaterials),
    supplierInvoiceMaterials: approvedSupplierMaterials,
    serviceM8Materials: toCurrencyNumber(job.materialsCostServiceM8),
    manualMaterialAdjustment: toCurrencyNumber(job.manualMaterialAdjustment),
    materialCostSource: job.materialCostSource,
    invoiceMatchStatus:
      confirmedMatches.length > 0
        ? confirmedMatches.some((match) => match.status === MatchStatus.MANUALLY_CONFIRMED)
          ? "MANUALLY_CONFIRMED"
          : "MATCHED"
        : possibleMatches.length > 0
          ? "POSSIBLE_MATCH"
          : "UNMATCHED",
    invoiceCount: confirmedMatches.length,
    possibleInvoiceCount: possibleMatches.length,
    supplierInvoiceStatus:
      job.supplierAllocations.length === 0
        ? "UNASSIGNED"
        : job.supplierAllocations.some((allocation) => !allocation.supplierInvoice.isIncludedInJobCosting)
          ? "NEEDS_REVIEW"
          : "ASSIGNED",
    warnings,
    dataConfidence: warnings.length === 0 ? "Complete" : "Needs review",
    supplierInvoices: job.supplierAllocations.map(serializeSupplierAllocation),
    timeEntries: job.timeEntries.map((entry) => ({
      id: entry.id,
      staffId: entry.staffId,
      staffName: entry.staffName,
      startTime: entry.startTime?.toISOString() ?? null,
      endTime: entry.endTime?.toISOString() ?? null,
      durationMinutes: entry.durationMinutes
    })),
    matchedInvoices: confirmedMatches.map((match) => ({
      id: match.id,
      matchType: match.matchType,
      status: match.status,
      confidenceScore: match.confidenceScore,
      notes: match.notes,
      invoice: {
        id: match.invoice.id,
        invoiceNumber: match.invoice.invoiceNumber,
        invoiceDate: match.invoice.invoiceDate.toISOString(),
        totalExVat: toCurrencyNumber(match.invoice.totalExVat),
        vatAmount: toCurrencyNumber(match.invoice.vatAmount),
        totalIncVat: toCurrencyNumber(match.invoice.totalIncVat),
        paymentStatus: match.invoice.paymentStatus,
        reference: match.invoice.reference
      }
    })),
    possibleInvoices: possibleMatches.map((match) => ({
      id: match.id,
      matchType: match.matchType,
      confidenceScore: match.confidenceScore,
      notes: match.notes,
      invoice: {
        id: match.invoice.id,
        invoiceNumber: match.invoice.invoiceNumber,
        invoiceDate: match.invoice.invoiceDate.toISOString(),
        totalExVat: toCurrencyNumber(match.invoice.totalExVat),
        reference: match.invoice.reference
      }
    })),
    ...profitability,
    revenuePerLabourHour: profitability.revenuePerLabourHour === null ? null : roundCurrency(profitability.revenuePerLabourHour),
    grossProfitBeforeLabourPerHour:
      profitability.grossProfitBeforeLabourPerHour === null
        ? null
        : roundCurrency(profitability.grossProfitBeforeLabourPerHour),
    grossProfitAfterLabourPerHour:
      profitability.grossProfitAfterLabourPerHour === null
        ? null
        : roundCurrency(profitability.grossProfitAfterLabourPerHour),
    marginBeforeLabour:
      profitability.marginBeforeLabour === null ? null : roundCurrency(profitability.marginBeforeLabour * 100),
    marginAfterLabour:
      profitability.marginAfterLabour === null ? null : roundCurrency(profitability.marginAfterLabour * 100)
  };
};

export const getJobsWithMetrics = async (filters: JobFilters = {}) => {
  const [jobs, rates] = await Promise.all([
    prisma.job.findMany({
      where: getJobWhere(filters),
      include: {
        invoiceMatches: {
          include: {
            invoice: true
          }
        },
        timeEntries: true,
        supplierAllocations: {
          include: {
            supplierInvoice: true
          }
        }
      },
      orderBy: [
        {
          completionDate: "desc"
        },
        {
          jobDate: "desc"
        }
      ]
    }),
    getStaffRateMaps()
  ]);

  let rows = jobs.map((job) => toJobPerformance(job, rates));

  if (filters.matchStatus) {
    rows = rows.filter((job) => job.invoiceMatchStatus === filters.matchStatus);
  }

  if (filters.missingMaterials) {
    rows = rows.filter((job) => job.materials === 0);
  }

  if (filters.missingTime) {
    rows = rows.filter((job) => job.labourHours === 0);
  }

  return rows;
};

const sanitizeJobForRole = (job: Awaited<ReturnType<typeof getJobsWithMetrics>>[number], role: UserRole) => {
  if (isFinancialRole(role)) {
    return job;
  }

  return {
    id: job.id,
    serviceM8JobId: job.serviceM8JobId,
    jobName: job.jobName,
    jobNumber: job.jobNumber,
    customerName: job.customerName,
    address: job.address,
    status: job.status,
    jobDate: job.jobDate,
    completionDate: job.completionDate,
    leadSource: job.leadSource,
    jobType: job.jobType,
    labourHours: job.labourHours,
    warnings: job.warnings.filter((warning) => {
      const lower = warning.toLowerCase();
      return !lower.includes("material") && !lower.includes("quickbooks") && !lower.includes("supplier") && !lower.includes("labour cost");
    }),
    dataConfidence: job.dataConfidence
  };
};

export const getJobsTable = async (
  filters: JobFilters & {
    page?: number;
    pageSize?: number;
  },
  role: UserRole
) => {
  const jobs = await getJobsWithMetrics(filters);
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const total = jobs.length;
  const startIndex = (page - 1) * pageSize;
  const items = jobs.slice(startIndex, startIndex + pageSize).map((job) => sanitizeJobForRole(job, role));

  return {
    page,
    pageSize,
    total,
    items
  };
};

export const getJobDetail = async (jobId: string, role: UserRole) => {
  const [jobRows, auditLogs] = await Promise.all([
    getJobsWithMetrics({}),
    prisma.auditLog.findMany({
      where: {
        entityId: jobId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 30
    })
  ]);
  const job = jobRows.find((row) => row.id === jobId);

  if (!job) {
    return null;
  }

  return {
    job: sanitizeJobForRole(job, role),
    auditLogs: isFinancialRole(role)
      ? auditLogs.map((log) => ({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          oldValue: log.oldValue,
          newValue: log.newValue,
          reason: log.reason,
          createdAt: log.createdAt.toISOString()
        }))
      : []
  };
};

const getSupplierWarningCounts = async () => {
  const [needsReview, failed, unassigned, duplicates] = await Promise.all([
    prisma.supplierInvoice.count({ where: { extractionStatus: SupplierInvoiceStatus.NEEDS_REVIEW } }),
    prisma.supplierInvoice.count({ where: { extractionStatus: SupplierInvoiceStatus.FAILED } }),
    prisma.supplierInvoice.count({
      where: {
        assignedJobId: null,
        extractionStatus: {
          notIn: [SupplierInvoiceStatus.IGNORED, SupplierInvoiceStatus.REMOVED]
        }
      }
    }),
    prisma.supplierInvoice.count({
      where: {
        OR: [{ extractionStatus: SupplierInvoiceStatus.POSSIBLE_DUPLICATE }, { isDuplicateSuspected: true }]
      }
    })
  ]);

  return {
    supplierInvoicesNeedingReview: needsReview,
    failedInvoiceReads: failed,
    unassignedSupplierInvoices: unassigned,
    possibleDuplicateSupplierInvoices: duplicates
  };
};

export const getOverviewData = async (role: UserRole, from?: Date, to?: Date) => {
  const now = new Date();
  const rangeStart = from || startOfMonth(now);
  const rangeEnd = to || endOfMonth(now);
  const jobs = await getJobsWithMetrics({ from: rangeStart, to: rangeEnd });
  const allJobs = await getJobsWithMetrics();
  const [futureJobs, unmatchedInvoices, possibleMatches, missingSupplierCounts, syncConnections, pnl] = await Promise.all([
    prisma.job.findMany({
      where: {
        jobDate: {
          gt: now,
          lte: addDays(now, 56)
        }
      }
    }),
    prisma.invoice.count({
      where: {
        jobMatches: {
          none: {
            status: {
              in: [MatchStatus.MATCHED, MatchStatus.MANUALLY_CONFIRMED]
            }
          }
        }
      }
    }),
    prisma.jobInvoiceMatch.count({ where: { status: MatchStatus.POSSIBLE_MATCH } }),
    getSupplierWarningCounts(),
    prisma.integrationConnection.findMany({ orderBy: { provider: "asc" } }),
    getPnlData(rangeStart, rangeEnd)
  ]);

  const visibleProfit = isFinancialRole(role);
  const completedJobsInRange = jobs.filter((job) => isCompletedStatus(job.status));
  const revenueThisMonth = roundCurrency(completedJobsInRange.reduce((total, job) => total + job.revenueExVat, 0));
  const grossProfitBeforeLabour = roundCurrency(completedJobsInRange.reduce((total, job) => total + job.grossProfitBeforeLabour, 0));
  const jobsWithLabourCost = completedJobsInRange.filter((job) => job.grossProfitAfterLabour !== null);
  const grossProfitAfterLabour = roundCurrency(
    jobsWithLabourCost.reduce((total, job) => total + (job.grossProfitAfterLabour || 0), 0)
  );
  const totalLabourHours = roundCurrency(completedJobsInRange.reduce((total, job) => total + job.labourHours, 0));
  const completedJobs = completedJobsInRange.length;
  const averageJobValue = roundCurrency(safeDivide(revenueThisMonth, completedJobs) || 0);
  const averageProfitPerJob = roundCurrency(safeDivide(grossProfitBeforeLabour, completedJobs) || 0);
  const bookedNext4 = futureJobs.filter(
    (job) => job.jobDate && job.jobDate <= addDays(now, 28) && !isCancelledStatus(job.status) && isAcceptedStatus(job.status)
  );
  const bookedNext8 = futureJobs.filter((job) => !isCancelledStatus(job.status) && isAcceptedStatus(job.status));

  const monthlyMap = new Map<string, { month: string; revenue: number; grossProfit: number; netProfit: number; labourHours: number }>();
  for (const job of allJobs.filter((row) => isCompletedStatus(row.status))) {
    const reportDate = job.completionDate || job.jobDate;
    if (!reportDate) continue;
    const key = formatMonthKey(new Date(reportDate));
    const current = monthlyMap.get(key) || { month: key, revenue: 0, grossProfit: 0, netProfit: 0, labourHours: 0 };
    current.revenue += job.revenueExVat;
    current.grossProfit += job.grossProfitBeforeLabour;
    current.labourHours += job.labourHours;
    monthlyMap.set(key, current);
  }
  for (const row of pnl.monthlyTrend) {
    const current = monthlyMap.get(row.month) || { month: row.month, revenue: 0, grossProfit: 0, netProfit: 0, labourHours: 0 };
    current.netProfit = row.netProfitBeforeTax;
    monthlyMap.set(row.month, current);
  }

  const trend = Array.from(monthlyMap.values())
    .sort((left, right) => left.month.localeCompare(right.month))
    .slice(-6)
    .map((item) => ({
      month: item.month,
      revenue: visibleProfit ? roundCurrency(item.revenue) : 0,
      grossProfit: visibleProfit ? roundCurrency(item.grossProfit) : null,
      netProfit: visibleProfit ? roundCurrency(item.netProfit) : null,
      labourHours: roundCurrency(item.labourHours)
    }));

  const leadSourceRows = visibleProfit ? await getMarketingData(role, rangeStart, rangeEnd) : [];

  return {
    summary: {
      revenueThisMonth: visibleProfit ? revenueThisMonth : null,
      grossProfitBeforeLabour: visibleProfit ? grossProfitBeforeLabour : null,
      grossProfitAfterLabour: visibleProfit ? grossProfitAfterLabour : null,
      pnlNetProfitThisMonth: visibleProfit ? pnl.summary.netProfitBeforeTax : null,
      profitPerLabourHour: visibleProfit ? roundCurrency(safeDivide(grossProfitBeforeLabour, totalLabourHours) || 0) : null,
      labourHours: totalLabourHours,
      completedJobs,
      averageJobValue: visibleProfit ? averageJobValue : null,
      averageProfitPerJob: visibleProfit ? averageProfitPerJob : null,
      bookedWorkNext4Weeks: visibleProfit ? bookedNext4.reduce((total, job) => total + toCurrencyNumber(job.quotedValue), 0) : null,
      bookedWorkNext8Weeks: visibleProfit ? bookedNext8.reduce((total, job) => total + toCurrencyNumber(job.quotedValue), 0) : null,
      unmatchedQuickBooksInvoices: visibleProfit ? unmatchedInvoices : null,
      possibleQuickBooksMatches: visibleProfit ? possibleMatches : null,
      jobsWithMissingMaterials: visibleProfit ? allJobs.filter((job) => job.materials === 0 && isCompletedStatus(job.status)).length : null,
      jobsWithNoTimeLogged: allJobs.filter((job) => job.labourHours === 0 && isCompletedStatus(job.status)).length,
      materialCostsMissing: visibleProfit ? allJobs.filter((job) => job.warnings.includes("No material cost recorded")).length : null,
      supplierInvoicesNeedingReview: visibleProfit ? missingSupplierCounts.supplierInvoicesNeedingReview : null,
      failedInvoiceReads: visibleProfit ? missingSupplierCounts.failedInvoiceReads : null,
      unassignedSupplierInvoices: visibleProfit ? missingSupplierCounts.unassignedSupplierInvoices : null,
      possibleDuplicateSupplierInvoices: visibleProfit ? missingSupplierCounts.possibleDuplicateSupplierInvoices : null
    },
    trend,
    leadSources: leadSourceRows.slice(0, 5),
    syncConnections: visibleProfit
      ? syncConnections.map((connection) => ({
          provider: connection.provider,
          mode: connection.mode,
          status: connection.status,
          lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt?.toISOString() ?? null,
          lastError: connection.lastError
        }))
      : []
  };
};

export const getMarketingData = async (role: UserRole, from?: Date, to?: Date) => {
  const jobs = (await getJobsWithMetrics({ from, to })).filter((job) => isCompletedStatus(job.status));
  const grouped = new Map<string, { leadSource: string; jobs: number; revenue: number; profitBefore: number; profitAfter: number; labourHours: number }>();

  for (const job of jobs) {
    const key = job.leadSource || "Unknown";
    const current = grouped.get(key) || { leadSource: key, jobs: 0, revenue: 0, profitBefore: 0, profitAfter: 0, labourHours: 0 };
    current.jobs += 1;
    current.revenue += job.revenueExVat;
    current.profitBefore += job.grossProfitBeforeLabour;
    current.profitAfter += job.grossProfitAfterLabour || 0;
    current.labourHours += job.labourHours;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((row) => ({
      leadSource: row.leadSource,
      jobs: row.jobs,
      revenue: roundCurrency(row.revenue),
      grossProfitBeforeLabour: isFinancialRole(role) ? roundCurrency(row.profitBefore) : null,
      grossProfitAfterLabour: isFinancialRole(role) ? roundCurrency(row.profitAfter) : null,
      labourHours: roundCurrency(row.labourHours),
      avgJobValue: roundCurrency(safeDivide(row.revenue, row.jobs) || 0),
      averageProfitPerJob: isFinancialRole(role) ? roundCurrency(safeDivide(row.profitBefore, row.jobs) || 0) : null,
      revenuePerLabourHour: roundCurrency(safeDivide(row.revenue, row.labourHours) || 0),
      profitPerHour: isFinancialRole(role) ? roundCurrency(safeDivide(row.profitBefore, row.labourHours) || 0) : null
    }))
    .sort((left, right) => right.revenue - left.revenue);
};

export const getJobTypeData = async (role: UserRole, from?: Date, to?: Date) => {
  const jobs = (await getJobsWithMetrics({ from, to })).filter((job) => isCompletedStatus(job.status));
  const grouped = new Map<string, { jobType: string; jobs: number; revenue: number; profit: number; labourHours: number; estimatedHours: number; estimatedMaterials: number; materials: number }>();

  for (const job of jobs) {
    const key = job.jobType || "Other";
    const current = grouped.get(key) || { jobType: key, jobs: 0, revenue: 0, profit: 0, labourHours: 0, estimatedHours: 0, estimatedMaterials: 0, materials: 0 };
    current.jobs += 1;
    current.revenue += job.revenueExVat;
    current.profit += job.grossProfitBeforeLabour;
    current.labourHours += job.labourHours;
    current.estimatedHours += job.estimatedHours || 0;
    current.estimatedMaterials += job.estimatedMaterials || 0;
    current.materials += job.materials;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((row) => ({
      jobType: row.jobType,
      jobs: row.jobs,
      revenue: roundCurrency(row.revenue),
      profit: isFinancialRole(role) ? roundCurrency(row.profit) : null,
      profitPerHour: isFinancialRole(role) ? roundCurrency(safeDivide(row.profit, row.labourHours) || 0) : null,
      averageJobValue: roundCurrency(safeDivide(row.revenue, row.jobs) || 0),
      labourHours: roundCurrency(row.labourHours),
      estimatedHoursVsActual: roundCurrency(row.labourHours - row.estimatedHours),
      estimatedMaterialsVsActual: roundCurrency(row.materials - row.estimatedMaterials),
      revenuePerHour: roundCurrency(safeDivide(row.revenue, row.labourHours) || 0)
    }))
    .sort((left, right) => right.revenue - left.revenue);
};

export const getPipelineData = async () => {
  const now = new Date();
  const jobs = await prisma.job.findMany({
    orderBy: [{ jobDate: "asc" }]
  });
  const quoted = jobs.filter((job) => isQuotedStatus(job.status));
  const accepted = jobs.filter((job) => isAcceptedStatus(job.status));
  const bookedFuture = jobs.filter(
    (job) =>
      job.jobDate &&
      job.jobDate > now &&
      !isCancelledStatus(job.status) &&
      (isAcceptedStatus(job.status) || isCompletedStatus(job.status))
  );
  const next4 = bookedFuture.filter((job) => job.jobDate && job.jobDate <= addDays(now, 28));
  const next8 = bookedFuture.filter((job) => job.jobDate && job.jobDate <= addDays(now, 56));

  const summarize = (rows: typeof jobs) => ({
    count: rows.length,
    estimatedRevenue: roundCurrency(rows.reduce((total, job) => total + toCurrencyNumber(job.quotedValue), 0)),
    estimatedLabourHours: roundCurrency(rows.reduce((total, job) => total + toCurrencyNumber(job.estimatedHours), 0))
  });

  return {
    quoted: summarize(quoted),
    accepted: summarize(accepted),
    next4Weeks: summarize(next4),
    next8Weeks: summarize(next8),
    acceptedButNotBooked: accepted.filter((job) => !job.jobDate).length,
    quotesNotAccepted: quoted.length,
    futureJobs: bookedFuture.slice(0, 30).map((job) => ({
      id: job.id,
      jobName: job.jobName,
      customerName: job.customerName,
      jobDate: job.jobDate?.toISOString() ?? null,
      jobStatus: job.status,
      leadSource: job.leadSource,
      jobType: job.jobType,
      quotedValue: toCurrencyNumber(job.quotedValue),
      estimatedHours: toCurrencyNumber(job.estimatedHours)
    }))
  };
};

export const getPnlData = async (from?: Date, to?: Date) => {
  const now = new Date();
  const rangeStart = from || startOfMonth(now);
  const rangeEnd = to || endOfMonth(now);
  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({ where: dateRangeWhere("invoiceDate", rangeStart, rangeEnd) }),
    prisma.expense.findMany({ where: dateRangeWhere("expenseDate", rangeStart, rangeEnd) })
  ]);
  const revenueExVat = roundCurrency(invoices.reduce((total, invoice) => total + toCurrencyNumber(invoice.totalExVat), 0));
  const categoryTotals = new Map<string, number>();

  for (const expense of expenses) {
    categoryTotals.set(
      expense.dashboardCategory,
      roundCurrency((categoryTotals.get(expense.dashboardCategory) || 0) + toCurrencyNumber(expense.amountExVat))
    );
  }

  const directCategories = ["materials_direct_purchases", "subcontractor_costs", "direct_costs"];
  const directCosts = roundCurrency(directCategories.reduce((total, category) => total + (categoryTotals.get(category) || 0), 0));
  const grossProfit = roundCurrency(revenueExVat - directCosts);
  const overheads = roundCurrency(
    Array.from(categoryTotals.entries())
      .filter(([category]) => !directCategories.includes(category))
      .reduce((total, [, amount]) => total + amount, 0)
  );
  const netProfitBeforeTax = roundCurrency(grossProfit - overheads);

  const allInvoices = await prisma.invoice.findMany();
  const allExpenses = await prisma.expense.findMany();
  const months = new Map<string, { month: string; revenueExVat: number; expenses: number; netProfitBeforeTax: number }>();

  for (const invoice of allInvoices) {
    const month = formatMonthKey(invoice.invoiceDate);
    const current = months.get(month) || { month, revenueExVat: 0, expenses: 0, netProfitBeforeTax: 0 };
    current.revenueExVat += toCurrencyNumber(invoice.totalExVat);
    months.set(month, current);
  }

  for (const expense of allExpenses) {
    const month = formatMonthKey(expense.expenseDate);
    const current = months.get(month) || { month, revenueExVat: 0, expenses: 0, netProfitBeforeTax: 0 };
    current.expenses += toCurrencyNumber(expense.amountExVat);
    months.set(month, current);
  }

  const monthlyTrend = Array.from(months.values())
    .sort((left, right) => left.month.localeCompare(right.month))
    .map((row) => ({
      month: row.month,
      revenueExVat: roundCurrency(row.revenueExVat),
      expenses: roundCurrency(row.expenses),
      netProfitBeforeTax: roundCurrency(row.revenueExVat - row.expenses)
    }));

  return {
    summary: {
      revenueExVat,
      directCosts,
      grossProfit,
      grossMargin: roundCurrency((safeDivide(grossProfit, revenueExVat) || 0) * 100),
      overheads,
      netProfitBeforeTax,
      netMargin: roundCurrency((safeDivide(netProfitBeforeTax, revenueExVat) || 0) * 100)
    },
    categories: Array.from(categoryTotals.entries()).map(([dashboardCategory, amountExVat]) => ({
      dashboardCategory,
      amountExVat
    })),
    monthlyTrend,
    rolling3Month: monthlyTrend.slice(-3),
    rolling12Month: monthlyTrend.slice(-12),
    ytd: monthlyTrend
      .filter((row) => row.month.startsWith(String(rangeEnd.getFullYear())))
      .reduce(
        (total, row) => ({
          revenueExVat: roundCurrency(total.revenueExVat + row.revenueExVat),
          expenses: roundCurrency(total.expenses + row.expenses),
          netProfitBeforeTax: roundCurrency(total.netProfitBeforeTax + row.netProfitBeforeTax)
        }),
        { revenueExVat: 0, expenses: 0, netProfitBeforeTax: 0 }
      )
  };
};

export const getMatchesOverview = async () => {
  const [unmatchedJobs, unmatchedInvoices, possibleMatches, confirmedMatches, ignoredMatches] = await Promise.all([
    prisma.job.findMany({
      where: {
        invoiceMatches: {
          none: {
            status: {
              in: [MatchStatus.MATCHED, MatchStatus.MANUALLY_CONFIRMED]
            }
          }
        }
      },
      orderBy: [{ completionDate: "desc" }, { jobDate: "desc" }]
    }),
    prisma.invoice.findMany({
      where: {
        jobMatches: {
          none: {
            status: {
              in: [MatchStatus.MATCHED, MatchStatus.MANUALLY_CONFIRMED, MatchStatus.IGNORED]
            }
          }
        }
      },
      orderBy: { invoiceDate: "desc" }
    }),
    prisma.jobInvoiceMatch.findMany({
      where: { status: MatchStatus.POSSIBLE_MATCH },
      include: { job: true, invoice: true },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.jobInvoiceMatch.findMany({
      where: { status: { in: [MatchStatus.MATCHED, MatchStatus.MANUALLY_CONFIRMED] } },
      include: {
        job: true,
        invoice: true,
        manuallyConfirmedBy: { select: { id: true, name: true } }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.jobInvoiceMatch.findMany({
      where: { status: MatchStatus.IGNORED },
      include: { job: true, invoice: true },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  const serializeInvoice = (invoice: (typeof unmatchedInvoices)[number]) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    invoiceDate: invoice.invoiceDate.toISOString(),
    totalExVat: toCurrencyNumber(invoice.totalExVat),
    vatAmount: toCurrencyNumber(invoice.vatAmount),
    totalIncVat: toCurrencyNumber(invoice.totalIncVat),
    reference: invoice.reference,
    memo: invoice.memo,
    paymentStatus: invoice.paymentStatus
  });
  const serializeJob = (job: (typeof unmatchedJobs)[number]) => ({
    id: job.id,
    jobName: job.jobName,
    jobNumber: job.jobNumber,
    customerName: job.customerName,
    jobDate: job.jobDate?.toISOString() ?? null,
    completionDate: job.completionDate?.toISOString() ?? null,
    jobStatus: job.status,
    leadSource: job.leadSource
  });
  const serializeMatch = (
    match: (typeof possibleMatches)[number] | (typeof confirmedMatches)[number] | (typeof ignoredMatches)[number]
  ) => ({
    id: match.id,
    matchType: match.matchType,
    status: match.status,
    confidenceScore: match.confidenceScore,
    notes: match.notes,
    job: serializeJob(match.job),
    invoice: serializeInvoice(match.invoice),
    manuallyConfirmedBy: "manuallyConfirmedBy" in match ? match.manuallyConfirmedBy : null,
    updatedAt: match.updatedAt.toISOString()
  });

  return {
    unmatchedJobs: unmatchedJobs.map(serializeJob),
    unmatchedInvoices: unmatchedInvoices.map(serializeInvoice),
    possibleMatches: possibleMatches.map(serializeMatch),
    confirmedMatches: confirmedMatches.map(serializeMatch),
    ignoredMatches: ignoredMatches.map(serializeMatch)
  };
};

export const getStaffPerformanceData = async () => {
  const entries = await prisma.timeEntry.findMany({
    include: {
      job: true
    }
  });
  const grouped = new Map<string, { staffName: string; minutes: number; jobs: Set<string> }>();

  for (const entry of entries) {
    const current = grouped.get(entry.staffName) || {
      staffName: entry.staffName,
      minutes: 0,
      jobs: new Set<string>()
    };
    current.minutes += entry.durationMinutes;
    current.jobs.add(entry.jobId);
    grouped.set(entry.staffName, current);
  }

  return Array.from(grouped.values()).map((row) => ({
    staffName: row.staffName,
    labourHours: roundCurrency(row.minutes / 60),
    jobs: row.jobs.size
  }));
};
