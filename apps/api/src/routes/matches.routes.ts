import { Router } from "express";
import { z } from "zod";

import { MatchStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../lib/async-handler.js";
import { createAuditLog } from "../lib/audit.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getMatchesOverview } from "../services/metrics.service.js";
import { createManualMatch, removeMatch } from "../services/sync.service.js";

const router = Router();

const manualMatchSchema = z.object({
  jobId: z.string().min(1),
  invoiceId: z.string().min(1),
  notes: z.string().max(500).optional(),
  split: z.boolean().optional()
});

router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "MANAGER", "READ_ONLY"),
  asyncHandler(async (_request, response) => {
    const data = await getMatchesOverview();
    response.json(data);
  })
);

router.post(
  "/manual",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const payload = manualMatchSchema.parse(request.body);
    const link = await createManualMatch({
      ...payload,
      userId: request.user!.sub
    });

    await createAuditLog({
      userId: request.user!.sub,
      action: "match.manual_override",
      entityType: "jobInvoiceMatch",
      entityId: link.id,
      newValue: payload,
      ipAddress: request.ip
    });

    response.status(201).json({
      link
    });
  })
);

router.post(
  "/:matchId/confirm",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const before = await prisma.jobInvoiceMatch.findUniqueOrThrow({
      where: {
        id: request.params.matchId
      }
    });
    const match = await prisma.jobInvoiceMatch.update({
      where: {
        id: request.params.matchId
      },
      data: {
        status: MatchStatus.MANUALLY_CONFIRMED,
        confidenceScore: 1,
        manuallyConfirmedByUserId: request.user!.sub
      }
    });

    await createAuditLog({
      userId: request.user!.sub,
      action: "match.confirmed",
      entityType: "jobInvoiceMatch",
      entityId: match.id,
      oldValue: JSON.parse(JSON.stringify(before)),
      newValue: JSON.parse(JSON.stringify(match)),
      ipAddress: request.ip
    });

    response.json({ match });
  })
);

router.delete(
  "/:linkId",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    await removeMatch(request.params.linkId);

    await createAuditLog({
      userId: request.user!.sub,
      action: "match.deactivate",
      entityType: "jobInvoiceMatch",
      entityId: request.params.linkId,
      ipAddress: request.ip
    });

    response.status(204).send();
  })
);

export { router as matchesRouter };
