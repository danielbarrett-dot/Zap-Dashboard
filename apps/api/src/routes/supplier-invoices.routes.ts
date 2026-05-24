import { SupplierAllocationType, SupplierInvoiceStatus } from "@prisma/client";
import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";

import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  allocateSupplierInvoice,
  amendSupplierInvoice,
  getSupplierInvoiceDetail,
  getSupplierInvoices,
  revalidateSupplierInvoice,
  setSupplierInvoiceStatus
} from "../services/supplier-invoices.service.js";

const router = Router();

const allocationSchema = z.object({
  allocations: z
    .array(
      z.object({
        jobId: z.string().min(1),
        amountExVat: z.number().nonnegative(),
        allocationType: z.nativeEnum(SupplierAllocationType).default(SupplierAllocationType.MANUAL),
        percentage: z.number().nonnegative().optional(),
        notes: z.string().max(500).optional()
      })
    )
    .min(1),
  notes: z.string().max(500).optional(),
  replaceExisting: z.boolean().default(true)
});

const amendSchema = z.object({
  values: z.object({
    supplierName: z.string().nullable().optional(),
    invoiceNumber: z.string().nullable().optional(),
    invoiceDate: z.string().nullable().optional(),
    reference: z.string().nullable().optional(),
    netAmount: z.number().nullable().optional(),
    vatAmount: z.number().nullable().optional(),
    grossAmount: z.number().nullable().optional(),
    carriageNetAmount: z.number().nullable().optional(),
    notes: z.string().nullable().optional()
  }),
  reason: z.string().max(500).optional()
});

const statusSchema = z.object({
  status: z.nativeEnum(SupplierInvoiceStatus),
  reason: z.string().max(500).optional()
});

const canViewSupplierInvoices = (request: Request) =>
  request.user!.role !== "READ_ONLY" || request.user!.permissions?.view_supplier_invoices;

router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "MANAGER", "READ_ONLY"),
  asyncHandler(async (request, response) => {
    if (!canViewSupplierInvoices(request)) {
      response.status(403).json({ message: "You do not have permission to access this resource" });
      return;
    }

    const tab = typeof request.query.tab === "string" ? request.query.tab : "needs_review";
    response.json(await getSupplierInvoices(tab));
  })
);

router.get(
  "/:invoiceId",
  requireAuth,
  requireRole("ADMIN", "MANAGER", "READ_ONLY"),
  asyncHandler(async (request, response) => {
    if (!canViewSupplierInvoices(request)) {
      response.status(403).json({ message: "You do not have permission to access this resource" });
      return;
    }

    response.json({
      invoice: await getSupplierInvoiceDetail(request.params.invoiceId)
    });
  })
);

router.post(
  "/:invoiceId/allocate",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const payload = allocationSchema.parse(request.body);
    const invoice = await allocateSupplierInvoice({
      invoiceId: request.params.invoiceId,
      allocations: payload.allocations,
      notes: payload.notes,
      replaceExisting: payload.replaceExisting,
      userId: request.user!.sub,
      ipAddress: request.ip
    });

    response.json({ invoice });
  })
);

router.patch(
  "/:invoiceId",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const payload = amendSchema.parse(request.body);
    const invoice = await amendSupplierInvoice({
      invoiceId: request.params.invoiceId,
      userId: request.user!.sub,
      values: payload.values,
      reason: payload.reason,
      ipAddress: request.ip
    });

    response.json({ invoice });
  })
);

router.post(
  "/:invoiceId/status",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const payload = statusSchema.parse(request.body);
    const invoice = await setSupplierInvoiceStatus({
      invoiceId: request.params.invoiceId,
      userId: request.user!.sub,
      status: payload.status,
      reason: payload.reason,
      ipAddress: request.ip
    });

    response.json({ invoice });
  })
);

router.post(
  "/:invoiceId/reprocess",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    await revalidateSupplierInvoice(request.params.invoiceId);
    response.json({
      invoice: await getSupplierInvoiceDetail(request.params.invoiceId)
    });
  })
);

export { router as supplierInvoicesRouter };
