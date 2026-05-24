import type { Prisma } from "@prisma/client";

import { prisma } from "../config/prisma.js";

type AuditInput = {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  reason?: string;
  ipAddress?: string;
};

export const createAuditLog = async (input: AuditInput) =>
  prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue,
      newValue: input.newValue ?? input.metadata,
      reason: input.reason,
      ipAddress: input.ipAddress
    }
  });

export const createManualOverride = async (input: {
  userId?: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  reason?: string;
}) => {
  const override = await prisma.manualOverride.create({
    data: input
  });

  await createAuditLog({
    userId: input.userId,
    action: "manual_override.created",
    entityType: input.entityType,
    entityId: input.entityId,
    oldValue: input.oldValue,
    newValue: input.newValue,
    reason: input.reason
  });

  return override;
};
