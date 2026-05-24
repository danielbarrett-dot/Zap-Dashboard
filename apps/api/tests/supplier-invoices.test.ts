import assert from "node:assert/strict";
import test from "node:test";

import {
  detectSupplierInvoiceDuplicate,
  validateSupplierInvoiceReviewState
} from "../src/domain/supplier-invoices.js";

test("flags invoices with missing totals and low confidence for review", () => {
  const result = validateSupplierInvoiceReviewState({
    supplierName: "CEF York",
    invoiceNumber: "CEF-1",
    invoiceDate: "2026-04-05",
    netAmount: null,
    vatAmount: 10,
    grossAmount: 20,
    extractionConfidence: 0.5,
    matchingConfidence: 0.5
  });

  assert.equal(result.requiresReview, true);
  assert.ok(result.reasons.includes("Missing net total"));
  assert.ok(result.reasons.includes("Low extraction confidence"));
});

test("detects duplicate supplier invoices using file hash and supplier invoice number", () => {
  const signals = detectSupplierInvoiceDuplicate(
    {
      supplierName: "CEF York",
      invoiceNumber: "CEF-44321",
      invoiceDate: "2026-04-05",
      netAmount: 525,
      grossAmount: 630,
      fileHash: "same-hash"
    },
    [
      {
        id: "existing",
        supplierName: "CEF York",
        invoiceNumber: "CEF-44321",
        invoiceDate: "2026-04-05",
        netAmount: 525,
        grossAmount: 630,
        fileHash: "same-hash"
      }
    ]
  );

  assert.ok(signals.includes("same file hash"));
  assert.ok(signals.includes("same supplier and invoice number"));
});

test("does not approve price mismatches", () => {
  const result = validateSupplierInvoiceReviewState({
    supplierName: "Toolstation",
    invoiceNumber: "TS-1",
    invoiceDate: "2026-05-18",
    netAmount: 120,
    vatAmount: 20,
    grossAmount: 148,
    extractionConfidence: 0.95,
    matchingConfidence: 0.95,
    assignedJobId: "job-1"
  });

  assert.equal(result.requiresReview, true);
  assert.ok(result.reasons.includes("Price mismatch"));
});
