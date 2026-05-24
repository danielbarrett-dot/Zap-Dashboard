export type NormalizedJobRecord = {
  serviceM8JobId: string;
  jobName: string;
  jobNumber?: string | null;
  customerName: string;
  customerId?: string | null;
  address?: string | null;
  status: string;
  jobDate?: string | null;
  completionDate?: string | null;
  createdAtServiceM8?: string | null;
  updatedAtServiceM8?: string | null;
  leadSource?: string | null;
  jobType?: string | null;
  assignedStaff: string[];
  totalTimeMinutes: number;
  materialsCostServiceM8: number;
  subcontractorCost: number;
  estimatedHours?: number | null;
  estimatedMaterials?: number | null;
  quotedValue?: number | null;
  payload: Record<string, unknown>;
};

export type NormalizedStaffRecord = {
  serviceM8StaffId: string;
  name: string;
  email?: string | null;
  active: boolean;
  hourlyCostRate?: number | null;
};

export type NormalizedTimeEntryRecord = {
  serviceM8BookingId: string;
  jobServiceM8JobId: string;
  staffId?: string | null;
  staffName: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes: number;
};

export type ServiceM8SyncPayload = {
  jobs: NormalizedJobRecord[];
  timeEntries: NormalizedTimeEntryRecord[];
  staff: NormalizedStaffRecord[];
};

export type NormalizedInvoiceRecord = {
  quickBooksInvoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerId?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  totalExVat: number;
  vatAmount: number;
  totalIncVat: number;
  balanceDue: number;
  paymentStatus: string;
  reference?: string | null;
  memo?: string | null;
  createdAtQuickBooks?: string | null;
  updatedAtQuickBooks?: string | null;
  payload: Record<string, unknown>;
};

export type NormalizedPaymentRecord = {
  quickBooksPaymentId: string;
  invoiceQuickBooksInvoiceId?: string | null;
  paymentDate: string;
  amount: number;
  paymentMethod?: string | null;
};

export type NormalizedExpenseRecord = {
  quickBooksExpenseId: string;
  supplierName: string;
  expenseDate: string;
  accountName: string;
  accountType: string;
  category?: string | null;
  dashboardCategory: string;
  description?: string | null;
  amountExVat: number;
  vatAmount: number;
  amountIncVat: number;
  paymentStatus?: string | null;
  reference?: string | null;
  linkedCustomerName?: string | null;
  linkedServiceM8JobId?: string | null;
  createdAtQuickBooks?: string | null;
  updatedAtQuickBooks?: string | null;
  payload: Record<string, unknown>;
};

export type QuickBooksSyncPayload = {
  invoices: NormalizedInvoiceRecord[];
  payments: NormalizedPaymentRecord[];
  expenses: NormalizedExpenseRecord[];
};
