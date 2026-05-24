export type UserRole = "ADMIN" | "MANAGER" | "READ_ONLY" | "STAFF";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  twoFactorEnabled: boolean;
  permissions: Record<string, boolean>;
};

export type JobMetric = {
  id: string;
  serviceM8JobId?: string | null;
  jobName: string;
  jobNumber?: string | null;
  customerName: string;
  address?: string | null;
  status: string;
  jobDate: string | null;
  completionDate: string | null;
  leadSource?: string | null;
  jobType?: string | null;
  revenueExVat?: number;
  materials?: number;
  supplierInvoiceMaterials?: number;
  serviceM8Materials?: number;
  manualMaterialAdjustment?: number;
  subcontractors?: number;
  labourHours: number;
  labourCost?: number | null;
  grossProfitBeforeLabour?: number;
  grossProfitAfterLabour?: number | null;
  revenuePerLabourHour?: number | null;
  grossProfitBeforeLabourPerHour?: number | null;
  grossProfitAfterLabourPerHour?: number | null;
  quotedValue?: number | null;
  estimatedHours?: number | null;
  estimatedMaterials?: number | null;
  estimatedVsActualHours?: number | null;
  estimatedVsActualMaterials?: number | null;
  materialCostSource?: string;
  invoiceMatchStatus?: string;
  supplierInvoiceStatus?: string;
  dataConfidence: string;
  warnings: string[];
  matchedInvoices?: Array<Record<string, unknown>>;
  supplierInvoices?: Array<Record<string, unknown>>;
  timeEntries?: Array<Record<string, unknown>>;
};

export type OverviewResponse = {
  summary: {
    revenueThisMonth: number | null;
    grossProfitBeforeLabour: number | null;
    grossProfitAfterLabour: number | null;
    pnlNetProfitThisMonth: number | null;
    profitPerLabourHour: number | null;
    labourHours: number;
    completedJobs: number;
    averageJobValue: number | null;
    averageProfitPerJob: number | null;
    bookedWorkNext4Weeks: number | null;
    bookedWorkNext8Weeks: number | null;
    unmatchedQuickBooksInvoices: number | null;
    possibleQuickBooksMatches: number | null;
    jobsWithMissingMaterials: number | null;
    jobsWithNoTimeLogged: number | null;
    materialCostsMissing: number | null;
    supplierInvoicesNeedingReview: number | null;
    failedInvoiceReads: number | null;
    unassignedSupplierInvoices: number | null;
    possibleDuplicateSupplierInvoices: number | null;
  };
  trend: Array<{
    month: string;
    revenue: number;
    grossProfit: number | null;
    netProfit: number | null;
    labourHours: number;
  }>;
  leadSources: MarketingResponse["rows"];
  syncConnections: SyncStatusResponse["connections"];
};

export type JobsResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: JobMetric[];
};

export type JobDetailResponse = {
  job: JobMetric;
  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    oldValue: unknown;
    newValue: unknown;
    reason: string | null;
    createdAt: string;
  }>;
};

export type MarketingResponse = {
  rows: Array<{
    leadSource: string;
    jobs: number;
    revenue: number;
    grossProfitBeforeLabour: number | null;
    grossProfitAfterLabour: number | null;
    labourHours: number;
    avgJobValue: number;
    averageProfitPerJob: number | null;
    revenuePerLabourHour: number;
    profitPerHour: number | null;
  }>;
};

export type JobTypesResponse = {
  rows: Array<{
    jobType: string;
    jobs: number;
    revenue: number;
    profit: number | null;
    profitPerHour: number | null;
    averageJobValue: number;
    labourHours: number;
    estimatedHoursVsActual: number;
    estimatedMaterialsVsActual: number;
    revenuePerHour: number;
  }>;
};

export type PipelineResponse = {
  quoted: { count: number; estimatedRevenue: number; estimatedLabourHours: number };
  accepted: { count: number; estimatedRevenue: number; estimatedLabourHours: number };
  next4Weeks: { count: number; estimatedRevenue: number; estimatedLabourHours: number };
  next8Weeks: { count: number; estimatedRevenue: number; estimatedLabourHours: number };
  acceptedButNotBooked: number;
  quotesNotAccepted: number;
  futureJobs: Array<{
    id: string;
    jobName: string;
    customerName: string;
    jobDate: string | null;
    jobStatus: string;
    leadSource: string | null;
    jobType: string | null;
    quotedValue: number;
    estimatedHours: number;
  }>;
};

export type MatchJobSummary = {
  id: string;
  jobName: string;
  jobNumber: string | null;
  customerName: string;
  jobDate: string | null;
  completionDate: string | null;
  jobStatus: string;
  leadSource: string | null;
};

export type MatchInvoiceSummary = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  totalExVat: number;
  vatAmount: number;
  totalIncVat: number;
  reference: string | null;
  memo: string | null;
  paymentStatus: string;
};

export type MatchRow = {
  id: string;
  matchType: string;
  status: string;
  confidenceScore: number | null;
  notes: string | null;
  job: MatchJobSummary;
  invoice: MatchInvoiceSummary;
  manuallyConfirmedBy: { id: string; name: string } | null;
  updatedAt: string;
};

export type MatchesResponse = {
  unmatchedJobs: MatchJobSummary[];
  unmatchedInvoices: MatchInvoiceSummary[];
  possibleMatches: MatchRow[];
  confirmedMatches: MatchRow[];
  ignoredMatches: MatchRow[];
};

export type SupplierInvoicesResponse = {
  tab: string;
  counts: Record<string, number>;
  invoices: SupplierInvoiceRow[];
};

export type SupplierInvoiceRow = {
  id: string;
  supplierName: string | null;
  supplierEmail: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  reference: string | null;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  carriageNetAmount: number;
  currency: string;
  extractionStatus: string;
  extractionConfidence: number | null;
  matchingConfidence: number | null;
  reviewReason: string | null;
  sourceEmailSubject: string | null;
  sourceEmailReceivedAt: string | null;
  attachmentFilename: string | null;
  assignedJob: { id: string; jobName: string; jobNumber: string | null; customerName: string } | null;
  isDuplicateSuspected: boolean;
  isIncludedInJobCosting: boolean;
  notes: string | null;
  warnings: string[];
  allocations: Array<Record<string, unknown>>;
  lineItems: Array<Record<string, unknown>>;
};

export type PnlTrendRow = { month: string; revenueExVat: number; expenses: number; netProfitBeforeTax: number };

export type PnlResponse = {
  summary: {
    revenueExVat: number;
    directCosts: number;
    grossProfit: number;
    grossMargin: number;
    overheads: number;
    netProfitBeforeTax: number;
    netMargin: number;
  };
  categories: Array<{ dashboardCategory: string; amountExVat: number }>;
  monthlyTrend: PnlTrendRow[];
  rolling3Month: PnlTrendRow[];
  rolling12Month: PnlTrendRow[];
  ytd: { revenueExVat: number; expenses: number; netProfitBeforeTax: number };
};

export type SyncStatusResponse = {
  connections: Array<{
    provider: string;
    mode: string;
    status: string | null;
    lastSuccessfulSyncAt: string | null;
    lastError: string | null;
  }>;
  recentRuns: Array<{
    id: string;
    provider: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    recordsSynced: number;
    errorMessage: string | null;
  }>;
};

export type AdminSettingsResponse = {
  settings: Array<{ id: string; key: string; value: unknown }>;
  quickBooksCategoryMappings: Array<{
    id: string;
    quickBooksAccountName: string;
    quickBooksAccountType: string;
    dashboardCategory: string;
  }>;
  staff: Array<{ id: string; serviceM8StaffId: string | null; name: string; email: string | null; active: boolean; hourlyCostRate: string | number | null }>;
  connections: SyncStatusResponse["connections"];
  syncLogs: Array<SyncStatusResponse["recentRuns"][number] & { source?: string }>;
  auditLogs: Array<Record<string, unknown>>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    lastLoginAt: string | null;
    permissions: Record<string, boolean>;
  }>;
};
