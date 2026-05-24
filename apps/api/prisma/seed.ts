import {
  SupplierAllocationType,
  SupplierInvoiceStatus,
  SyncMode,
  SyncProvider,
  UserRole
} from "@prisma/client";

import { prisma } from "../src/config/prisma.js";
import { hashPassword } from "../src/lib/auth.js";
import { syncAllProviders } from "../src/services/sync.service.js";

const seedUsers = [
  {
    email: "admin@zap-electrical.co.uk",
    name: "Admin User",
    password: "AdminPass123!",
    role: UserRole.ADMIN,
    permissions: {}
  },
  {
    email: "manager@zap-electrical.co.uk",
    name: "Operations Manager",
    password: "ManagerPass123!",
    role: UserRole.MANAGER,
    permissions: {
      view_financials: true,
      view_supplier_invoices: true,
      review_matching: true,
      view_pnl: true
    }
  },
  {
    email: "readonly@zap-electrical.co.uk",
    name: "Read Only User",
    password: "ReadOnlyPass123!",
    role: UserRole.READ_ONLY,
    permissions: {
      view_financials: true,
      view_supplier_invoices: false,
      view_pnl: true
    }
  },
  {
    email: "staff@zap-electrical.co.uk",
    name: "Field Engineer",
    password: "StaffPass123!",
    role: UserRole.STAFF,
    permissions: {}
  }
];

const categoryMappings = [
  ["Materials", "Cost of Goods Sold", "materials_direct_purchases"],
  ["Subcontractors", "Cost of Goods Sold", "subcontractor_costs"],
  ["Wages", "Expense", "wages_labour_cost"],
  ["Motor Expenses", "Expense", "vehicle_costs"],
  ["Insurance", "Expense", "insurance"],
  ["Software", "Expense", "software_subscriptions"],
  ["Rent", "Expense", "rent_storage"],
  ["Accountancy", "Expense", "accountancy_bookkeeping"],
  ["Finance Charges", "Expense", "finance_costs"],
  ["Bank Charges", "Expense", "bank_charges"],
  ["Advertising", "Expense", "advertising_marketing"],
  ["Training", "Expense", "training"],
  ["Tools", "Expense", "tools_equipment"],
  ["Other", "Expense", "other_overheads"]
] as const;

const upsertUsers = async () => {
  for (const user of seedUsers) {
    const passwordHash = await hashPassword(user.password);

    await prisma.user.upsert({
      where: {
        email: user.email
      },
      update: {
        name: user.name,
        role: user.role,
        passwordHash,
        isActive: true,
        permissions: {
          deleteMany: {},
          create: Object.entries(user.permissions).map(([permissionKey, allowed]) => ({
            permissionKey,
            allowed
          }))
        }
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
        permissions: {
          create: Object.entries(user.permissions).map(([permissionKey, allowed]) => ({
            permissionKey,
            allowed
          }))
        }
      }
    });
  }
};

const upsertConnectionsAndSettings = async () => {
  await prisma.integrationConnection.upsert({
    where: {
      provider: SyncProvider.SERVICEM8
    },
    update: {
      mode: SyncMode.MOCK,
      status: "CONNECTED"
    },
    create: {
      provider: SyncProvider.SERVICEM8,
      mode: SyncMode.MOCK,
      status: "CONNECTED"
    }
  });

  await prisma.integrationConnection.upsert({
    where: {
      provider: SyncProvider.QUICKBOOKS
    },
    update: {
      mode: SyncMode.MOCK,
      status: "CONNECTED"
    },
    create: {
      provider: SyncProvider.QUICKBOOKS,
      mode: SyncMode.MOCK,
      status: "CONNECTED"
    }
  });

  await prisma.integrationConnection.upsert({
    where: {
      provider: SyncProvider.SUPPLIER_INBOX
    },
    update: {
      mode: SyncMode.MOCK,
      status: "MOCK_INBOX"
    },
    create: {
      provider: SyncProvider.SUPPLIER_INBOX,
      mode: SyncMode.MOCK,
      status: "MOCK_INBOX"
    }
  });

  const settings = [
    ["servicem8.customFields", { materials: "Materials Cost (£)", leadSource: "Lead Source", jobType: "Job Type", subcontractorCost: "Subcontractor Cost", estimatedHours: "Estimated Hours", estimatedMaterials: "Estimated Materials" }],
    ["reporting.defaultDateBasis", { completedJobs: "completionDate", pipeline: "jobDate", pnl: "quickBooksTransactionDate" }],
    ["supplierInvoice.inbox", { address: "invoices@zap-dashboard.co.uk", mode: "MOCK" }],
    ["materials.defaultSourceRule", { rule: "DEFAULT_APPROVED_SUPPLIER_THEN_SERVICEM8" }]
  ] as const;

  for (const [key, value] of settings) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  }

  for (const [quickBooksAccountName, quickBooksAccountType, dashboardCategory] of categoryMappings) {
    await prisma.quickBooksCategoryMapping.upsert({
      where: {
        quickBooksAccountName_quickBooksAccountType: {
          quickBooksAccountName,
          quickBooksAccountType
        }
      },
      update: {
        dashboardCategory
      },
      create: {
        quickBooksAccountName,
        quickBooksAccountType,
        dashboardCategory
      }
    });
  }
};

const findJob = async (serviceM8JobId: string) =>
  prisma.job.findUniqueOrThrow({
    where: {
      serviceM8JobId
    }
  });

const seedSupplierInvoices = async () => {
  const admin = await prisma.user.findUniqueOrThrow({
    where: {
      email: "admin@zap-electrical.co.uk"
    }
  });
  const maple = await findJob("sm8-job-001");
  const ash = await findJob("sm8-job-002");
  const station = await findJob("sm8-job-004");
  const kingsway = await findJob("sm8-job-006");
  const sampleEmailIds = [
    "supplier-email-001",
    "supplier-email-002",
    "supplier-email-003",
    "supplier-email-004",
    "supplier-email-005",
    "supplier-email-006",
    "supplier-email-007"
  ];

  await prisma.supplierInvoice.deleteMany({
    where: {
      sourceEmailId: {
        in: sampleEmailIds
      }
    }
  });

  await prisma.supplierInvoice.create({
    data: {
      supplierName: "CEF York",
      supplierEmail: "invoices@york.cef.co.uk",
      invoiceNumber: "CEF-44321",
      invoiceDate: new Date("2026-04-05"),
      reference: "ZE-1001 Maple Street",
      netAmount: 525,
      vatAmount: 105,
      grossAmount: 630,
      carriageNetAmount: 0,
      extractionStatus: SupplierInvoiceStatus.ASSIGNED,
      extractionConfidence: 0.96,
      matchingConfidence: 0.94,
      sourceEmailId: "supplier-email-001",
      sourceEmailSubject: "CEF Invoice CEF-44321",
      sourceEmailReceivedAt: new Date("2026-04-05T15:20:00.000Z"),
      attachmentFilename: "CEF-44321.pdf",
      attachmentStoragePath: "mock://supplier-invoices/CEF-44321.pdf",
      fileHash: "hash-cef-44321",
      assignedJobId: maple.id,
      assignedByUserId: admin.id,
      assignedAt: new Date("2026-04-06T09:00:00.000Z"),
      isIncludedInJobCosting: true,
      notes: "Auto matched by job number and manually checked in seed data.",
      lineItems: {
        create: [
          { productCode: "6242Y-2.5", description: "Twin and earth cable 2.5mm", quantity: 3, unitPriceExVat: 88, lineTotalExVat: 264, vatRate: 20, assignedJobId: maple.id },
          { productCode: "CU-ACC", description: "Consumer accessories", quantity: 1, unitPriceExVat: 171, lineTotalExVat: 171, vatRate: 20, assignedJobId: maple.id },
          { productCode: "FIX", description: "Fixings and sundries", quantity: 1, unitPriceExVat: 90, lineTotalExVat: 90, vatRate: 20, assignedJobId: maple.id }
        ]
      },
      allocations: {
        create: {
          jobId: maple.id,
          amountExVat: 525,
          allocationType: SupplierAllocationType.FULL_INVOICE,
          assignedByUserId: admin.id,
          notes: "Full invoice allocated to Maple Street."
        }
      }
    }
  });

  await prisma.supplierInvoice.create({
    data: {
      supplierName: "Screwfix",
      supplierEmail: "no-reply@screwfix.com",
      invoiceNumber: "SF-8891",
      invoiceDate: new Date("2026-04-09"),
      reference: "Ash Grove",
      netAmount: 174,
      vatAmount: 34.8,
      grossAmount: 208.8,
      extractionStatus: SupplierInvoiceStatus.ASSIGNED,
      extractionConfidence: 0.93,
      matchingConfidence: 0.9,
      sourceEmailId: "supplier-email-002",
      sourceEmailSubject: "Screwfix invoice SF-8891",
      sourceEmailReceivedAt: new Date("2026-04-09T16:45:00.000Z"),
      attachmentFilename: "SF-8891.pdf",
      attachmentStoragePath: "mock://supplier-invoices/SF-8891.pdf",
      fileHash: "hash-sf-8891",
      assignedJobId: ash.id,
      assignedByUserId: admin.id,
      assignedAt: new Date("2026-04-10T08:15:00.000Z"),
      isIncludedInJobCosting: true,
      allocations: {
        create: {
          jobId: ash.id,
          amountExVat: 174,
          allocationType: SupplierAllocationType.FULL_INVOICE,
          assignedByUserId: admin.id
        }
      }
    }
  });

  await prisma.supplierInvoice.create({
    data: {
      supplierName: "Edmundson Electrical",
      supplierEmail: "accounts@edmundson.co.uk",
      invoiceNumber: "ED-77102",
      invoiceDate: new Date("2026-04-18"),
      reference: "Station Road / Kingsway split",
      netAmount: 920,
      vatAmount: 184,
      grossAmount: 1104,
      extractionStatus: SupplierInvoiceStatus.PARTIALLY_ASSIGNED,
      extractionConfidence: 0.91,
      matchingConfidence: 0.76,
      reviewReason: "Needs manual allocation: invoice partially allocated",
      sourceEmailId: "supplier-email-003",
      sourceEmailSubject: "Invoice ED-77102",
      sourceEmailReceivedAt: new Date("2026-04-18T12:10:00.000Z"),
      attachmentFilename: "ED-77102.pdf",
      attachmentStoragePath: "mock://supplier-invoices/ED-77102.pdf",
      fileHash: "hash-ed-77102",
      assignedByUserId: admin.id,
      assignedAt: new Date("2026-04-19T10:00:00.000Z"),
      isIncludedInJobCosting: true,
      allocations: {
        create: [
          { jobId: station.id, amountExVat: 410, allocationType: SupplierAllocationType.PARTIAL_AMOUNT, assignedByUserId: admin.id, notes: "Lighting materials." },
          { jobId: kingsway.id, amountExVat: 300, allocationType: SupplierAllocationType.PARTIAL_AMOUNT, assignedByUserId: admin.id, notes: "Office containment materials." }
        ]
      }
    }
  });

  await prisma.supplierInvoice.create({
    data: {
      supplierName: "Rexel",
      supplierEmail: "billing@rexel.co.uk",
      invoiceNumber: "RX-10044",
      invoiceDate: new Date("2026-05-11"),
      reference: "No clear job reference",
      netAmount: 683.2,
      vatAmount: 136.64,
      grossAmount: 819.84,
      extractionStatus: SupplierInvoiceStatus.NEEDS_REVIEW,
      extractionConfidence: 0.88,
      matchingConfidence: 0.31,
      reviewReason: "No job reference; Low matching confidence",
      sourceEmailId: "supplier-email-004",
      sourceEmailSubject: "Rexel Invoice RX-10044",
      sourceEmailReceivedAt: new Date("2026-05-11T08:30:00.000Z"),
      attachmentFilename: "RX-10044.pdf",
      attachmentStoragePath: "mock://supplier-invoices/RX-10044.pdf",
      fileHash: "hash-rx-10044",
      isIncludedInJobCosting: false
    }
  });

  await prisma.supplierInvoice.create({
    data: {
      supplierName: null,
      supplierEmail: "unknown@supplier.example",
      invoiceNumber: null,
      invoiceDate: null,
      reference: null,
      netAmount: null,
      vatAmount: null,
      grossAmount: null,
      extractionStatus: SupplierInvoiceStatus.FAILED,
      extractionConfidence: 0.12,
      matchingConfidence: 0,
      reviewReason: "Cannot read invoice; Failed OCR; Missing net total; Missing VAT; Missing gross total",
      sourceEmailId: "supplier-email-005",
      sourceEmailSubject: "Scanned invoice",
      sourceEmailReceivedAt: new Date("2026-05-14T17:05:00.000Z"),
      attachmentFilename: "scan-unknown.pdf",
      attachmentStoragePath: "mock://supplier-invoices/scan-unknown.pdf",
      fileHash: "hash-failed-scan",
      isIncludedInJobCosting: false
    }
  });

  await prisma.supplierInvoice.create({
    data: {
      supplierName: "CEF York",
      supplierEmail: "invoices@york.cef.co.uk",
      invoiceNumber: "CEF-44321",
      invoiceDate: new Date("2026-04-05"),
      reference: "Duplicate Maple Street",
      netAmount: 525,
      vatAmount: 105,
      grossAmount: 630,
      extractionStatus: SupplierInvoiceStatus.POSSIBLE_DUPLICATE,
      extractionConfidence: 0.95,
      matchingConfidence: 0.94,
      reviewReason: "Possible duplicate: same supplier and invoice number; same file hash",
      sourceEmailId: "supplier-email-006",
      sourceEmailSubject: "Fwd: CEF Invoice CEF-44321",
      sourceEmailReceivedAt: new Date("2026-05-15T09:05:00.000Z"),
      attachmentFilename: "CEF-44321-copy.pdf",
      attachmentStoragePath: "mock://supplier-invoices/CEF-44321-copy.pdf",
      fileHash: "hash-cef-44321",
      isDuplicateSuspected: true,
      isIncludedInJobCosting: false
    }
  });

  await prisma.supplierInvoice.create({
    data: {
      supplierName: "Toolstation",
      supplierEmail: "invoices@toolstation.com",
      invoiceNumber: "TS-7810",
      invoiceDate: new Date("2026-05-18"),
      reference: "General stock",
      netAmount: 120,
      vatAmount: 20,
      grossAmount: 148,
      extractionStatus: SupplierInvoiceStatus.NEEDS_REVIEW,
      extractionConfidence: 0.93,
      matchingConfidence: 0.1,
      reviewReason: "Price mismatch; No job reference; Needs manual allocation",
      sourceEmailId: "supplier-email-007",
      sourceEmailSubject: "Toolstation VAT Invoice TS-7810",
      sourceEmailReceivedAt: new Date("2026-05-18T11:20:00.000Z"),
      attachmentFilename: "TS-7810.pdf",
      attachmentStoragePath: "mock://supplier-invoices/TS-7810.pdf",
      fileHash: "hash-ts-7810",
      isIncludedInJobCosting: false
    }
  });
};

const run = async () => {
  await upsertUsers();
  await upsertConnectionsAndSettings();
  await syncAllProviders();
  await seedSupplierInvoices();
};

run()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
