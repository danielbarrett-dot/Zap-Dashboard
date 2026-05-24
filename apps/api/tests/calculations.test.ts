import assert from "node:assert/strict";
import test from "node:test";

import { calculateJobProfitability, calculateMaterialCost, safeDivide } from "../src/domain/calculations.js";

test("uses approved supplier invoices before ServiceM8 materials by default", () => {
  const result = calculateMaterialCost({
    approvedSupplierTotal: 525,
    serviceM8Materials: 850,
    manualAdjustment: 0,
    sourceRule: "DEFAULT_APPROVED_SUPPLIER_THEN_SERVICEM8"
  });

  assert.equal(result.materials, 525);
  assert.match(result.warnings.join(" "), /differ/);
});

test("manual override wins and is clearly warned", () => {
  const result = calculateMaterialCost({
    approvedSupplierTotal: 525,
    serviceM8Materials: 850,
    manualAdjustment: 0,
    manualOverride: 700,
    sourceRule: "MANUAL_DASHBOARD_OVERRIDE"
  });

  assert.equal(result.materials, 700);
  assert.deepEqual(result.warnings, ["Manual material override applied"]);
});

test("profit calculation handles missing labour cost and divide by zero", () => {
  const result = calculateJobProfitability({
    revenueExVat: 1000,
    approvedSupplierMaterials: 200,
    serviceM8Materials: 0,
    manualMaterialAdjustment: 0,
    materialCostSource: "DEFAULT_APPROVED_SUPPLIER_THEN_SERVICEM8",
    subcontractorCost: 100,
    labourMinutes: 0,
    labourCost: null
  });

  assert.equal(result.grossProfitBeforeLabour, 700);
  assert.equal(result.grossProfitAfterLabour, null);
  assert.equal(result.revenuePerLabourHour, null);
  assert.equal(safeDivide(10, 0), null);
});
