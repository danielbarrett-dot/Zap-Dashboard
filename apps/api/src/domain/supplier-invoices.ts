export type SupplierInvoiceForValidation = {
  supplierName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: Date | string | null;
  netAmount?: number | null;
  vatAmount?: number | null;
  grossAmount?: number | null;
  extractionConfidence?: number | null;
  matchingConfidence?: number | null;
  assignedJobId?: string | null;
  fileHash?: string | null;
  attachmentFilename?: string | null;
  sourceEmailSubject?: string | null;
  lineItemTotalExVat?: number | null;
  isCreditNote?: boolean;
  unsupportedAttachment?: boolean;
  passwordProtected?: boolean;
  corrupted?: boolean;
};

export type ExistingSupplierInvoice = {
  id: string;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: Date | string | null;
  netAmount?: number | null;
  grossAmount?: number | null;
  fileHash?: string | null;
  attachmentFilename?: string | null;
  sourceEmailSubject?: string | null;
};

const sameDay = (left?: Date | string | null, right?: Date | string | null) => {
  if (!left || !right) {
    return false;
  }

  return new Date(left).toISOString().slice(0, 10) === new Date(right).toISOString().slice(0, 10);
};

const equalsMoney = (left?: number | null, right?: number | null) =>
  typeof left === "number" && typeof right === "number" && Math.abs(left - right) < 0.01;

export const detectSupplierInvoiceDuplicate = (
  candidate: SupplierInvoiceForValidation,
  existingInvoices: ExistingSupplierInvoice[]
) => {
  const duplicateSignals: string[] = [];

  for (const existing of existingInvoices) {
    if (candidate.fileHash && existing.fileHash && candidate.fileHash === existing.fileHash) {
      duplicateSignals.push("same file hash");
    }

    if (
      candidate.supplierName &&
      existing.supplierName &&
      candidate.invoiceNumber &&
      existing.invoiceNumber &&
      candidate.supplierName.toLowerCase() === existing.supplierName.toLowerCase() &&
      candidate.invoiceNumber.toLowerCase() === existing.invoiceNumber.toLowerCase()
    ) {
      duplicateSignals.push("same supplier and invoice number");
    }

    if (
      candidate.supplierName &&
      existing.supplierName &&
      candidate.supplierName.toLowerCase() === existing.supplierName.toLowerCase() &&
      sameDay(candidate.invoiceDate, existing.invoiceDate) &&
      (equalsMoney(candidate.netAmount, existing.netAmount) || equalsMoney(candidate.grossAmount, existing.grossAmount))
    ) {
      duplicateSignals.push("same supplier/date/amount");
    }

    if (
      candidate.attachmentFilename &&
      existing.attachmentFilename &&
      candidate.attachmentFilename === existing.attachmentFilename
    ) {
      duplicateSignals.push("same attachment filename");
    }

    if (
      candidate.sourceEmailSubject &&
      existing.sourceEmailSubject &&
      candidate.sourceEmailSubject === existing.sourceEmailSubject &&
      equalsMoney(candidate.grossAmount, existing.grossAmount)
    ) {
      duplicateSignals.push("same email subject and gross total");
    }
  }

  return Array.from(new Set(duplicateSignals));
};

export const validateSupplierInvoiceReviewState = (
  invoice: SupplierInvoiceForValidation,
  existingInvoices: ExistingSupplierInvoice[] = [],
  confidenceThreshold = 0.85
) => {
  const reasons: string[] = [];

  if (invoice.unsupportedAttachment) {
    reasons.push("Unsupported attachment");
  }

  if (invoice.passwordProtected) {
    reasons.push("Password protected file");
  }

  if (invoice.corrupted) {
    reasons.push("Corrupted file");
  }

  if (!invoice.supplierName) {
    reasons.push("Supplier name cannot be identified");
  }

  if (!invoice.invoiceNumber) {
    reasons.push("Invoice number cannot be identified");
  }

  if (!invoice.invoiceDate) {
    reasons.push("Invoice date cannot be identified");
  }

  if (invoice.netAmount === null || invoice.netAmount === undefined) {
    reasons.push("Missing net total");
  }

  if (invoice.vatAmount === null || invoice.vatAmount === undefined) {
    reasons.push("Missing VAT");
  }

  if (invoice.grossAmount === null || invoice.grossAmount === undefined) {
    reasons.push("Missing gross total");
  }

  if (
    typeof invoice.netAmount === "number" &&
    typeof invoice.vatAmount === "number" &&
    typeof invoice.grossAmount === "number" &&
    Math.abs(invoice.netAmount + invoice.vatAmount - invoice.grossAmount) > 0.02
  ) {
    reasons.push("Price mismatch");
  }

  if (
    typeof invoice.lineItemTotalExVat === "number" &&
    typeof invoice.netAmount === "number" &&
    Math.abs(invoice.lineItemTotalExVat - invoice.netAmount) > 0.02
  ) {
    reasons.push("Line item total mismatch");
  }

  if ((invoice.extractionConfidence ?? 0) < confidenceThreshold) {
    reasons.push("Low extraction confidence");
  }

  if ((invoice.matchingConfidence ?? 0) < confidenceThreshold) {
    reasons.push("Low matching confidence");
  }

  if (!invoice.assignedJobId) {
    reasons.push("No job reference");
  }

  if ((invoice.netAmount ?? 0) < 0 || (invoice.grossAmount ?? 0) < 0 || invoice.isCreditNote) {
    reasons.push("Credit note or negative invoice");
  }

  const duplicateSignals = detectSupplierInvoiceDuplicate(invoice, existingInvoices);

  if (duplicateSignals.length > 0) {
    reasons.push(`Possible duplicate: ${duplicateSignals.join(", ")}`);
  }

  return {
    requiresReview: reasons.length > 0,
    reasons,
    isDuplicateSuspected: duplicateSignals.length > 0
  };
};
