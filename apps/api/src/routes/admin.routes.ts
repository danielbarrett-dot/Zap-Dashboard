import { Router } from "express";
import { z } from "zod";

import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../lib/async-handler.js";
import { createAuditLog } from "../lib/audit.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown()
});

const staffRateSchema = z.object({
  hourlyCostRate: z.number().nonnegative().nullable()
});

const categoryMappingSchema = z.object({
  quickBooksAccountName: z.string().min(1),
  quickBooksAccountType: z.string().min(1),
  dashboardCategory: z.string().min(1)
});

router.get(
  "/settings",
  requireAuth,
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (_request, response) => {
    const [settings, mappings, staff, connections, syncLogs, auditLogs, users] = await Promise.all([
      prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
      prisma.quickBooksCategoryMapping.findMany({ orderBy: { dashboardCategory: "asc" } }),
      prisma.staff.findMany({ orderBy: { name: "asc" } }),
      prisma.integrationConnection.findMany({ orderBy: { provider: "asc" } }),
      prisma.syncLog.findMany({ take: 20, orderBy: { startedAt: "desc" } }),
      prisma.auditLog.findMany({
        take: 30,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } }
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        include: { permissions: true }
      })
    ]);

    response.json({
      settings,
      quickBooksCategoryMappings: mappings,
      staff,
      connections,
      syncLogs,
      auditLogs,
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        permissions: Object.fromEntries(user.permissions.map((permission) => [permission.permissionKey, permission.allowed]))
      }))
    });
  })
);

router.put(
  "/settings",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const payload = settingSchema.parse(request.body);
    const setting = await prisma.systemSetting.upsert({
      where: {
        key: payload.key
      },
      update: {
        value: payload.value as never
      },
      create: {
        key: payload.key,
        value: payload.value as never
      }
    });

    await createAuditLog({
      userId: request.user!.sub,
      action: "setting.upserted",
      entityType: "systemSetting",
      entityId: setting.id,
      newValue: JSON.parse(JSON.stringify(setting)),
      ipAddress: request.ip
    });

    response.json({ setting });
  })
);

router.patch(
  "/staff/:staffId/rate",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const payload = staffRateSchema.parse(request.body);
    const before = await prisma.staff.findUniqueOrThrow({ where: { id: request.params.staffId } });
    const staff = await prisma.staff.update({
      where: { id: request.params.staffId },
      data: { hourlyCostRate: payload.hourlyCostRate }
    });

    await createAuditLog({
      userId: request.user!.sub,
      action: "staff.hourly_rate_updated",
      entityType: "staff",
      entityId: staff.id,
      oldValue: JSON.parse(JSON.stringify(before)),
      newValue: JSON.parse(JSON.stringify(staff)),
      ipAddress: request.ip
    });

    response.json({ staff });
  })
);

router.put(
  "/quickbooks-category-mappings",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const payload = categoryMappingSchema.parse(request.body);
    const mapping = await prisma.quickBooksCategoryMapping.upsert({
      where: {
        quickBooksAccountName_quickBooksAccountType: {
          quickBooksAccountName: payload.quickBooksAccountName,
          quickBooksAccountType: payload.quickBooksAccountType
        }
      },
      update: {
        dashboardCategory: payload.dashboardCategory
      },
      create: payload
    });

    await createAuditLog({
      userId: request.user!.sub,
      action: "quickbooks_category_mapping.upserted",
      entityType: "quickBooksCategoryMapping",
      entityId: mapping.id,
      newValue: JSON.parse(JSON.stringify(mapping)),
      ipAddress: request.ip
    });

    response.json({ mapping });
  })
);

export { router as adminRouter };
