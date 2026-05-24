import { Router } from "express";
import { z } from "zod";

import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../lib/async-handler.js";
import { createManualOverride } from "../lib/audit.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  getJobsTable,
  getJobDetail,
  getJobTypeData,
  getMarketingData,
  getOverviewData,
  getPnlData,
  getPipelineData,
  getStaffPerformanceData
} from "../services/metrics.service.js";

const router = Router();

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  leadSource: z.string().optional(),
  jobType: z.string().optional(),
  customer: z.string().optional(),
  jobStatus: z.string().optional(),
  matchStatus: z.string().optional(),
  missingMaterials: z.coerce.boolean().optional(),
  missingTime: z.coerce.boolean().optional(),
  materialCostSource: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional()
});
const jobOverrideSchema = z.object({
  fieldName: z.enum([
    "manualMaterialOverride",
    "manualMaterialAdjustment",
    "subcontractorCost",
    "leadSource",
    "jobType",
    "estimatedHours",
    "estimatedMaterials",
    "materialCostSource",
    "notes"
  ]),
  value: z.union([z.string(), z.number(), z.null()]),
  reason: z.string().max(500).optional()
});

const toDate = (value?: string) => (value ? new Date(value) : undefined);
const effectiveFinancialRole = (user: Express.Request["user"]) =>
  user?.role === "READ_ONLY" && !user.permissions?.view_financials ? "STAFF" : user!.role;

router.get(
  "/overview",
  requireAuth,
  asyncHandler(async (request, response) => {
    const { from, to } = querySchema.parse(request.query);
    const data = await getOverviewData(effectiveFinancialRole(request.user), toDate(from), toDate(to));
    response.json(data);
  })
);

router.patch(
  "/jobs/:jobId/override",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const payload = jobOverrideSchema.parse(request.body);
    const before = await prisma.job.findUniqueOrThrow({
      where: {
        id: request.params.jobId
      }
    });
    const updated = await prisma.job.update({
      where: {
        id: request.params.jobId
      },
      data: {
        [payload.fieldName]: payload.value
      } as never
    });

    await createManualOverride({
      userId: request.user!.sub,
      entityType: "job",
      entityId: request.params.jobId,
      fieldName: payload.fieldName,
      oldValue: JSON.parse(JSON.stringify((before as unknown as Record<string, unknown>)[payload.fieldName] ?? null)),
      newValue: JSON.parse(JSON.stringify(payload.value)),
      reason: payload.reason
    });

    response.json({ job: updated });
  })
);

router.get(
  "/jobs",
  requireAuth,
  asyncHandler(async (request, response) => {
    const query = querySchema.parse(request.query);
    const data = await getJobsTable(
      {
        from: toDate(query.from),
        to: toDate(query.to),
        leadSource: query.leadSource,
        jobType: query.jobType,
        customer: query.customer,
        jobStatus: query.jobStatus,
        matchStatus: query.matchStatus,
        missingMaterials: query.missingMaterials,
        missingTime: query.missingTime,
        materialCostSource: query.materialCostSource as never,
        page: query.page,
        pageSize: query.pageSize
      },
      effectiveFinancialRole(request.user)
    );

    response.json(data);
  })
);

router.get(
  "/jobs/:jobId",
  requireAuth,
  asyncHandler(async (request, response) => {
    const data = await getJobDetail(request.params.jobId, effectiveFinancialRole(request.user));

    if (!data) {
      response.status(404).json({ message: "Job not found" });
      return;
    }

    response.json(data);
  })
);

router.get(
  "/marketing",
  requireAuth,
  requireRole("ADMIN", "MANAGER", "READ_ONLY"),
  asyncHandler(async (request, response) => {
    const { from, to } = querySchema.parse(request.query);
    if (request.user!.role === "READ_ONLY" && !request.user!.permissions?.view_financials) {
      response.status(403).json({ message: "You do not have permission to access this resource" });
      return;
    }
    const data = await getMarketingData(request.user!.role, toDate(from), toDate(to));
    response.json({
      rows: data
    });
  })
);

router.get(
  "/job-types",
  requireAuth,
  requireRole("ADMIN", "MANAGER", "READ_ONLY"),
  asyncHandler(async (request, response) => {
    const { from, to } = querySchema.parse(request.query);
    if (request.user!.role === "READ_ONLY" && !request.user!.permissions?.view_financials) {
      response.status(403).json({ message: "You do not have permission to access this resource" });
      return;
    }
    const data = await getJobTypeData(request.user!.role, toDate(from), toDate(to));
    response.json({
      rows: data
    });
  })
);

router.get(
  "/pipeline",
  requireAuth,
  requireRole("ADMIN", "MANAGER", "READ_ONLY"),
  asyncHandler(async (_request, response) => {
    if (_request.user!.role === "READ_ONLY" && !_request.user!.permissions?.view_financials) {
      response.status(403).json({ message: "You do not have permission to access this resource" });
      return;
    }
    const data = await getPipelineData();
    response.json(data);
  })
);

router.get(
  "/pnl",
  requireAuth,
  requireRole("ADMIN", "MANAGER", "READ_ONLY"),
  asyncHandler(async (request, response) => {
    if (request.user!.role === "READ_ONLY" && !request.user!.permissions?.view_pnl) {
      response.status(403).json({ message: "You do not have permission to access this resource" });
      return;
    }

    const { from, to } = querySchema.parse(request.query);
    const data = await getPnlData(toDate(from), toDate(to));
    response.json(data);
  })
);

router.get(
  "/staff",
  requireAuth,
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (_request, response) => {
    const data = await getStaffPerformanceData();
    response.json({
      rows: data
    });
  })
);

export { router as dashboardRouter };
