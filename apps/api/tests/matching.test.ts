import assert from "node:assert/strict";
import test from "node:test";

import { scoreInvoiceJobMatch } from "../src/domain/matching.js";

test("matches invoice references to ServiceM8 job numbers and names with high confidence", () => {
  const score = scoreInvoiceJobMatch(
    {
      id: "invoice-1",
      invoiceNumber: "1001",
      customerName: "Hawkins Family",
      invoiceDate: new Date("2026-04-08"),
      totalExVat: 5000,
      reference: "ZE-1001 Maple Street Rewire",
      memo: null
    },
    {
      id: "job-1",
      jobName: "Maple Street Rewire",
      jobNumber: "ZE-1001",
      customerName: "Hawkins Family",
      completionDate: new Date("2026-04-06"),
      quotedValue: 5000
    }
  );

  assert.equal(score.matchType, "AUTO_JOB_REFERENCE");
  assert.equal(score.status, "MATCHED");
  assert.ok(score.confidenceScore >= 0.9);
});

test("customer-only matches stay possible when confidence is lower", () => {
  const score = scoreInvoiceJobMatch(
    {
      id: "invoice-2",
      invoiceNumber: "1002",
      customerName: "Blue Oak Estates",
      invoiceDate: new Date("2026-04-13"),
      totalExVat: 290,
      reference: null,
      memo: null
    },
    {
      id: "job-2",
      jobName: "Church Lane EICR",
      customerName: "Blue Oak Estates",
      completionDate: new Date("2026-04-12"),
      quotedValue: 290
    }
  );

  assert.equal(score.matchType, "AUTO_CUSTOMER_NAME");
  assert.equal(score.status, "POSSIBLE_MATCH");
});
