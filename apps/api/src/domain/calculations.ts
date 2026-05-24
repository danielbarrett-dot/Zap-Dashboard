export type MaterialCostSourceRule =
  | "DEFAULT_APPROVED_SUPPLIER_THEN_SERVICEM8"
  | "SUPPLIER_INVOICES_ONLY"
  | "SERVICEM8_MANUAL_ONLY"
  | "SUPPLIER_PLUS_MANUAL"
  | "MANUAL_DASHBOARD_OVERRIDE"
  | "HIGHER_OF_SUPPLIER_OR_SERVICEM8"
  | "EXCLUDE_TEMPORARILY";

export type MaterialCostInput = {
  approvedSupplierTotal: number;
  serviceM8Materials: number;
  manualAdjustment: number;
  manualOverride?: number | null;
  sourceRule: MaterialCostSourceRule;
};

export type JobProfitabilityInput = {
  revenueExVat: number;
  approvedSupplierMaterials: number;
  serviceM8Materials: number;
  manualMaterialAdjustment: number;
  manualMaterialOverride?: number | null;
  materialCostSource: MaterialCostSourceRule;
  subcontractorCost: number;
  labourMinutes: number;
  labourCost?: number | null;
  quotedValue?: number | null;
  estimatedHours?: number | null;
  estimatedMaterials?: number | null;
};

export const roundCurrency = (value: number) =>
  Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0;

export const safeDivide = (numerator: number, denominator: number) => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
};

export const calculateMaterialCost = (input: MaterialCostInput) => {
  const supplier = roundCurrency(input.approvedSupplierTotal);
  const serviceM8 = roundCurrency(input.serviceM8Materials);
  const adjustment = roundCurrency(input.manualAdjustment);

  if (input.sourceRule === "EXCLUDE_TEMPORARILY") {
    return {
      materials: 0,
      label: "Excluded temporarily",
      warnings: ["Materials excluded from profitability"]
    };
  }

  if (input.sourceRule === "MANUAL_DASHBOARD_OVERRIDE") {
    const override = input.manualOverride;

    return {
      materials: roundCurrency(override ?? 0),
      label: "Manual dashboard override",
      warnings: ["Manual material override applied", ...(override === null || override === undefined ? ["Manual override amount missing"] : [])]
    };
  }

  if (input.sourceRule === "SUPPLIER_INVOICES_ONLY") {
    return {
      materials: supplier,
      label: "Supplier invoices only",
      warnings: supplier === 0 ? ["No approved supplier invoice materials"] : []
    };
  }

  if (input.sourceRule === "SERVICEM8_MANUAL_ONLY") {
    return {
      materials: serviceM8,
      label: "ServiceM8 materials field only",
      warnings: serviceM8 === 0 ? ["No ServiceM8 material cost recorded"] : []
    };
  }

  if (input.sourceRule === "SUPPLIER_PLUS_MANUAL") {
    return {
      materials: roundCurrency(supplier + adjustment),
      label: "Supplier invoices plus manual adjustment",
      warnings: [
        ...(supplier === 0 ? ["No approved supplier invoice materials"] : []),
        ...(adjustment !== 0 ? ["Manual material adjustment applied"] : [])
      ]
    };
  }

  if (input.sourceRule === "HIGHER_OF_SUPPLIER_OR_SERVICEM8") {
    return {
      materials: roundCurrency(Math.max(supplier, serviceM8) + adjustment),
      label: "Higher of supplier invoices or ServiceM8",
      warnings: [
        ...(supplier > 0 && serviceM8 > 0 && Math.abs(supplier - serviceM8) > 25
          ? ["Supplier invoices and ServiceM8 materials differ"]
          : []),
        ...(adjustment !== 0 ? ["Manual material adjustment applied"] : [])
      ]
    };
  }

  const chosen = supplier > 0 ? supplier : serviceM8;

  return {
    materials: roundCurrency(chosen + adjustment),
    label: supplier > 0 ? "Approved supplier invoices" : "ServiceM8 materials field",
    warnings: [
      ...(supplier === 0 && serviceM8 === 0 ? ["No material cost recorded"] : []),
      ...(supplier > 0 && serviceM8 > 0 && Math.abs(supplier - serviceM8) > 25
        ? ["Supplier invoices and ServiceM8 materials differ"]
        : []),
      ...(adjustment !== 0 ? ["Manual material adjustment applied"] : [])
    ]
  };
};

export const calculateJobProfitability = (input: JobProfitabilityInput) => {
  const materialResult = calculateMaterialCost({
    approvedSupplierTotal: input.approvedSupplierMaterials,
    serviceM8Materials: input.serviceM8Materials,
    manualAdjustment: input.manualMaterialAdjustment,
    manualOverride: input.manualMaterialOverride,
    sourceRule: input.materialCostSource
  });
  const revenueExVat = roundCurrency(input.revenueExVat);
  const materials = materialResult.materials;
  const subcontractors = roundCurrency(input.subcontractorCost);
  const labourHours = roundCurrency(input.labourMinutes / 60);
  const labourCost = input.labourCost === null || input.labourCost === undefined ? null : roundCurrency(input.labourCost);
  const grossProfitBeforeLabour = roundCurrency(revenueExVat - materials - subcontractors);
  const grossProfitAfterLabour =
    labourCost === null ? null : roundCurrency(grossProfitBeforeLabour - labourCost);

  return {
    revenueExVat,
    materials,
    materialCostLabel: materialResult.label,
    materialWarnings: materialResult.warnings,
    subcontractors,
    labourHours,
    labourCost,
    grossProfitBeforeLabour,
    grossProfitAfterLabour,
    revenuePerLabourHour: safeDivide(revenueExVat, labourHours),
    grossProfitBeforeLabourPerHour: safeDivide(grossProfitBeforeLabour, labourHours),
    grossProfitAfterLabourPerHour:
      grossProfitAfterLabour === null ? null : safeDivide(grossProfitAfterLabour, labourHours),
    marginBeforeLabour: safeDivide(grossProfitBeforeLabour, revenueExVat),
    marginAfterLabour:
      grossProfitAfterLabour === null ? null : safeDivide(grossProfitAfterLabour, revenueExVat),
    quotedVsActualRevenue:
      input.quotedValue === null || input.quotedValue === undefined
        ? null
        : roundCurrency(revenueExVat - input.quotedValue),
    estimatedVsActualHours:
      input.estimatedHours === null || input.estimatedHours === undefined
        ? null
        : roundCurrency(labourHours - input.estimatedHours),
    estimatedVsActualMaterials:
      input.estimatedMaterials === null || input.estimatedMaterials === undefined
        ? null
        : roundCurrency(materials - input.estimatedMaterials)
  };
};
