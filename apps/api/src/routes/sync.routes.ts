import { SyncProvider } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../lib/async-handler.js";
import { createAuditLog } from "../lib/audit.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { syncAllProviders, syncProvider } from "../services/sync.service.js";

const router = Router();

const syncRequestSchema = z.object({
  provider: z.enum(["ALL", "SERVICEM8", "QUICKBOOKS"]).default("ALL")
});

router.get(
  "/status",
  requireAuth,
  requireRole("ADMIN", "MANAGER", "READ_ONLY"),
  asyncHandler(async (_request, response) => {
    const [connections, recentRuns] = await Promise.all([
      prisma.integrationConnection.findMany({
        orderBy: {
          provider: "asc"
        }
      }),
      prisma.syncLog.findMany({
        take: 10,
        orderBy: {
          startedAt: "desc"
        }
      })
    ]);

    response.json({
      connections,
      recentRuns: recentRuns.map((run) => ({
        id: run.id,
        provider: run.source,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.completedAt,
        recordsSynced: run.recordsCreated + run.recordsUpdated,
        errorMessage: run.errorMessage
      }))
    });
  })
);

router.post(
  "/run",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const { provider } = syncRequestSchema.parse(request.body);
    const result =
      provider === "ALL"
        ? await syncAllProviders(request.user!.sub)
        : await syncProvider(SyncProvider[provider], request.user!.sub);

    await createAuditLog({
      userId: request.user!.sub,
      action: "sync.run",
      entityType: "integration",
      entityId: provider,
      metadata: {
        provider
      },
      ipAddress: request.ip
    });

    response.json({
      result
    });
  })
);

export { router as syncRouter };
