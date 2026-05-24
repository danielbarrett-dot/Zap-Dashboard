import {
  Prisma,
  SupplierAllocationType,
  SupplierInvoiceStatus
} from "@prisma/client";

import { prisma } from "../config/prisma.js";
import { validateSupplierInvoiceReviewState } from "../domain/supplier-invoices.js";
import { createAuditLog, createManualOverride } from "../lib/audit.js";
import { toCurrencyNumber } from "../utils/number.js";

const toDecimal = (value?: number | null) =>
  value === null || value === undefined ? null : new Prisma.Decimal(value.toFixed(2));
const nonNullDecimal = (value: number) => new Prisma.Decimal(value.toFixed(2));
const toDate = (value?: string | null) => (value ? new Date(value) : null);

const statusByTab: Record<string, SupplierInvoiceStatus[]> = {
  needs_review: [SupplierInvoiceStatus.NEEDS_REVIEW],
  new_unassigned: [SupplierInvoiceStatus.RECEIVED, SupplierInvoiceStatus.PARSED],
  assigned: [SupplierInvoiceStatus.ASSIGNED],
  partially_assigned: [SupplierInvoiceStatus.PARTIALLY_ASSIGNED],
  manually_corrected: [SupplierInvoiceStatus.MANUALLY_CORRECTED],
  ignored: [SupplierInvoiceStatus.IGNORED],
  removed: [SupplierInvoiceStatus.REMOVED],
  failed: [SupplierInvoiceStatus.FAILED],
  possible_duplicates: [SupplierInvoiceStatus.POSSIBLE_DUPLICATE]
};
const statusesExcludedFromJobCosting = new Set<SupplierInvoiceStatus>([
  SupplierInvoiceStatus.NEEDS_REVIEW,
  SupplierInvoiceStatus.FAILED,
  SupplierInvoiceStatus.IGNORED,
  SupplierInvoiceStatus.REMOVED,
  SupplierInvoiceStatus.POSSIBLE_DUPLICATE,
  SupplierInvoiceStatus.RECEIVED,
  SupplierInvoiceStatus.PARSED
]);

export const serializeSupplierInvoice = (
  invoice: Prisma.SupplierInvoiceGetPayload<{
    include: {
      assignedJob: true;
      allocations: { include: { job: true } };
      lineItems: true;
      assignedBy: { select: { id: true; name: true } };
    };
  }>
) => ({
  id: invoice.id,
  supplierName: invoice.supplierName,
  supplierEmail: invoice.supplierEmail,
  invoiceNumber: invoice.invoiceNumber,
  invoiceDate: invoice.invoiceDate?.toISOString() ?? null,
  reference: invoice.reference,
  netAmount: toCurrencyNumber(invoice.netAmount),
  vatAmount: toCurrencyNumber(invoice.vatAmount),
  grossAmount: toCurrencyNumber(invoice.grossAmount),
  carriageNetAmount: toCurrencyNumber(invoice.carriageNetAmount),
  currency: invoice.currency,
  extractionStatus: invoice.extractionStatus,
  extractionConfidence: invoice.extractionConfidence,
  matchingConfidence: invoice.matchingConfidence,
  reviewReason: invoice.reviewReason,
  sourceEmailSubject: invoice.sourceEmailSubject,
  sourceEmailReceivedAt: invoice.sourceEmailReceivedAt?.toISOString() ?? null,
  attachmentFilename: invoice.attachmentFilename,
  assignedJob: invoice.assignedJob
    ? {
        id: invoice.assignedJob.id,
        jobName: invoice.assignedJob.jobName,
        jobNumber: invoice.assignedJob.jobNumber,
        customerName: invoice.assignedJob.customerName
      }
    : null,
  assignedBy: invoice.assignedBy,
  assignedAt: invoice.assignedAt?.toISOString() ?? null,
  isDuplicateSuspected: invoice.isDuplicateSuspected,
  isIncludedInJobCosting: invoice.isIncludedInJobCosting,
  notes: invoice.notes,
  warnings: (invoice.reviewReason || "")
    .split(";")
    .map((reason) => reason.trim())
    .filter(Boolean),
  allocations: invoice.allocations.map((allocation) => ({
    id: allocation.id,
    jobId: allocation.jobId,
    jobName: allocation.job.jobName,
    customerName: allocation.job.customerName,
    amountExVat: toCurrencyNumber(allocation.amountExVat),
    allocationType: allocation.allocationType,
    percentage: allocation.percentage === null ? null : toCurrencyNumber(allocation.percentage),
    notes: allocation.notes
  })),
  lineItems: invoice.lineItems.map((line) => ({
    id: line.id,
    productCode: line.productCode,
    description: line.description,
    quantity: line.quantity === null ? null : Number(line.quantity),
    unitPriceExVat: toCurrencyNumber(line.unitPriceExVat),
    lineTotalExVat: toCurrencyNumber(line.lineTotalExVat),
    vatRate: line.vatRate === null ? null : Number(line.vatRate),
    category: line.category,
    assignedJobId: line.assignedJobId
  }))
});

export const getSupplierInvoices = async (tab = "needs_review") => {
  const statuses = statusByTab[tab] || statusByTab.needs_review;
  const invoices = await prisma.supplierInvoice.findMany({
    where: {
      extractionStatus: {
        in: statuses
      }
    },
    include: {
      assignedJob: true,
      assignedBy: {
        select: {
          id: true,
          name: true
        }
      },
      allocations: {
        include: {
          job: true
        }
      },
      lineItems: true
    },
    orderBy: {
      sourceEmailReceivedAt: "desc"
    }
  });

  const counts = await Promise.all(
    Object.entries(statusByTab).map(async ([key, values]) => [
      key,
      await prisma.supplierInvoice.count({
        where: {
          extractionStatus: {
            in: values
          }
        }
      })
    ])
  );

  return {
    tab,
    counts: Object.fromEntries(counts),
    invoices: invoices.map(serializeSupplierInvoice)
  };
};

export const getSupplierInvoiceDetail = async (invoiceId: string) => {
  const invoice = await prisma.supplierInvoice.findUniqueOrThrow({
    where: {
      id: invoiceId
    },
    include: {
      assignedJob: true,
      assignedBy: {
        select: {
          id: true,
          name: true
        }
      },
      allocations: {
        include: {
          job: true
        }
      },
      lineItems: true
    }
  });

  return serializeSupplierInvoice(invoice);
};

export const allocateSupplierInvoice = async (input: {
  invoiceId: string;
  allocations: Array<{
    jobId: string;
    amountExVat: number;
    allocationType: SupplierAllocationType;
    percentage?: number | null;
    notes?: string;
  }>;
  userId: string;
  notes?: string;
  replaceExisting?: boolean;
  ipAddress?: string;
}) => {
  const invoice = await prisma.supplierInvoice.findUniqueOrThrow({
    where: {
      id: input.invoiceId
    },
    include: {
      allocations: true
    }
  });

  if (input.replaceExisting) {
    await prisma.supplierInvoiceAllocation.deleteMany({
      where: {
        supplierInvoiceId: input.invoiceId
      }
    });
  }

  const totalAllocated = input.allocations.reduce((total, allocation) => total + allocation.amountExVat, 0);
  const invoiceNet = toCurrencyNumber(invoice.netAmount);
  const fullyAllocated = invoiceNet > 0 && Math.abs(invoiceNet - totalAllocated) < 0.02;
  const status =
    input.allocations.length === 1 && fullyAllocated
      ? SupplierInvoiceStatus.ASSIGNED
      : SupplierInvoiceStatus.PARTIALLY_ASSIGNED;

  await prisma.supplierInvoiceAllocation.createMany({
    data: input.allocations.map((allocation) => ({
      supplierInvoiceId: input.invoiceId,
      jobId: allocation.jobId,
      amountExVat: nonNullDecimal(allocation.amountExVat),
      allocationType: allocation.allocationType,
      percentage: toDecimal(allocation.percentage),
      notes: allocation.notes,
      assignedByUserId: input.userId
    }))
  });

  const updated = await prisma.supplierInvoice.update({
    where: {
      id: input.invoiceId
    },
    data: {
      extractionStatus: status,
      assignedJobId: input.allocations.length === 1 ? input.allocations[0].jobId : null,
      assignedByUserId: input.userId,
      assignedAt: new Date(),
      isIncludedInJobCosting: true,
      notes: input.notes ?? invoice.notes,
      reviewReason: status === SupplierInvoiceStatus.PARTIALLY_ASSIGNED ? "Needs manual allocation: invoice partially allocated" : null
    }
  });

  await createAuditLog({
    userId: input.userId,
    action: "supplier_invoice.assigned",
    entityType: "supplierInvoice",
    entityId: input.invoiceId,
    oldValue: JSON.parse(JSON.stringify(invoice)),
    newValue: JSON.parse(JSON.stringify(updated)),
    reason: input.notes,
    ipAddress: input.ipAddress
  });

  return getSupplierInvoiceDetail(input.invoiceId);
};

export const amendSupplierInvoice = async (input: {
  invoiceId: string;
  userId: string;
  values: {
    supplierName?: string | null;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    reference?: string | null;
    netAmount?: number | null;
    vatAmount?: number | null;
    grossAmount?: number | null;
    carriageNetAmount?: number | null;
    notes?: string | null;
  };
  reason?: string;
  ipAddress?: string;
}) => {
  const before = await prisma.supplierInvoice.findUniqueOrThrow({
    where: {
      id: input.invoiceId
    }
  });
  const data = {
    supplierName: input.values.supplierName,
    invoiceNumber: input.values.invoiceNumber,
    invoiceDate: input.values.invoiceDate === undefined ? undefined : toDate(input.values.invoiceDate),
    reference: input.values.reference,
    netAmount: input.values.netAmount === undefined ? undefined : toDecimal(input.values.netAmount),
    vatAmount: input.values.vatAmount === undefined ? undefined : toDecimal(input.values.vatAmount),
    grossAmount: input.values.grossAmount === undefined ? undefined : toDecimal(input.values.grossAmount),
    carriageNetAmount:
      input.values.carriageNetAmount === undefined ? undefined : toDecimal(input.values.carriageNetAmount),
    notes: input.values.notes,
    extractionStatus: SupplierInvoiceStatus.MANUALLY_CORRECTED
  };
  const updated = await prisma.supplierInvoice.update({
    where: {
      id: input.invoiceId
    },
    data
  });

  await Promise.all(
    Object.entries(input.values)
      .filter(([, value]) => value !== undefined)
      .map(([fieldName, newValue]) =>
        createManualOverride({
          userId: input.userId,
          entityType: "supplierInvoice",
          entityId: input.invoiceId,
          fieldName,
          oldValue: JSON.parse(JSON.stringify((before as unknown as Record<string, unknown>)[fieldName] ?? null)),
          newValue: JSON.parse(JSON.stringify(newValue ?? null)),
          reason: input.reason
        })
      )
  );

  await createAuditLog({
    userId: input.userId,
    action: "supplier_invoice.manually_amended",
    entityType: "supplierInvoice",
    entityId: input.invoiceId,
    oldValue: JSON.parse(JSON.stringify(before)),
    newValue: JSON.parse(JSON.stringify(updated)),
    reason: input.reason,
    ipAddress: input.ipAddress
  });

  return getSupplierInvoiceDetail(input.invoiceId);
};

export const setSupplierInvoiceStatus = async (input: {
  invoiceId: string;
  status: SupplierInvoiceStatus;
  userId: string;
  reason?: string;
  ipAddress?: string;
}) => {
  const before = await prisma.supplierInvoice.findUniqueOrThrow({
    where: {
      id: input.invoiceId
    }
  });
  const updated = await prisma.supplierInvoice.update({
    where: {
      id: input.invoiceId
    },
    data: {
      extractionStatus: input.status,
      isIncludedInJobCosting: !statusesExcludedFromJobCosting.has(input.status) && before.assignedJobId !== null,
      reviewReason: input.reason ?? before.reviewReason
    }
  });

  await createAuditLog({
    userId: input.userId,
    action: `supplier_invoice.${input.status.toLowerCase()}`,
    entityType: "supplierInvoice",
    entityId: input.invoiceId,
    oldValue: JSON.parse(JSON.stringify(before)),
    newValue: JSON.parse(JSON.stringify(updated)),
    reason: input.reason,
    ipAddress: input.ipAddress
  });

  return getSupplierInvoiceDetail(input.invoiceId);
};

export const revalidateSupplierInvoice = async (invoiceId: string) => {
  const invoice = await prisma.supplierInvoice.findUniqueOrThrow({
    where: {
      id: invoiceId
    },
    include: {
      lineItems: true
    }
  });
  const existing = await prisma.supplierInvoice.findMany({
    where: {
      id: {
        not: invoice.id
      }
    }
  });
  const lineItemTotalExVat = invoice.lineItems.length > 0 ? invoice.lineItems.reduce(
    (total, line) => total + toCurrencyNumber(line.lineTotalExVat),
    0
  ) : null;
  const result = validateSupplierInvoiceReviewState(
    {
      supplierName: invoice.supplierName,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      netAmount: invoice.netAmount === null ? null : toCurrencyNumber(invoice.netAmount),
      vatAmount: invoice.vatAmount === null ? null : toCurrencyNumber(invoice.vatAmount),
      grossAmount: invoice.grossAmount === null ? null : toCurrencyNumber(invoice.grossAmount),
      extractionConfidence: invoice.extractionConfidence,
      matchingConfidence: invoice.matchingConfidence,
      assignedJobId: invoice.assignedJobId,
      fileHash: invoice.fileHash,
      attachmentFilename: invoice.attachmentFilename,
      sourceEmailSubject: invoice.sourceEmailSubject,
      lineItemTotalExVat
    },
    existing.map((row) => ({
      id: row.id,
      supplierName: row.supplierName,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate,
      netAmount: row.netAmount === null ? null : toCurrencyNumber(row.netAmount),
      grossAmount: row.grossAmount === null ? null : toCurrencyNumber(row.grossAmount),
      fileHash: row.fileHash,
      attachmentFilename: row.attachmentFilename,
      sourceEmailSubject: row.sourceEmailSubject
    }))
  );

  return prisma.supplierInvoice.update({
    where: {
      id: invoiceId
    },
    data: {
      extractionStatus: result.isDuplicateSuspected
        ? SupplierInvoiceStatus.POSSIBLE_DUPLICATE
        : result.requiresReview
          ? SupplierInvoiceStatus.NEEDS_REVIEW
          : SupplierInvoiceStatus.PARSED,
      reviewReason: result.reasons.join("; ") || null,
      isDuplicateSuspected: result.isDuplicateSuspected,
      isIncludedInJobCosting: !result.requiresReview && Boolean(invoice.assignedJobId)
    }
  });
};
