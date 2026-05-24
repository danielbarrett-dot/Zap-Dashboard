import { UserRole } from "@prisma/client";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { Router } from "express";
import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { comparePassword, clearAuthCookie, getAuthCookieName, hashPassword, setAuthCookie, signAuthToken } from "../lib/auth.js";
import { asyncHandler } from "../lib/async-handler.js";
import { createAuditLog } from "../lib/audit.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { runLoginTriggeredSyncCheck } from "../services/sync.service.js";

const router = Router();

const getLoginRateLimitKey = (request: Request) => {
  const email =
    typeof request.body?.email === "string"
      ? request.body.email.trim().toLowerCase()
      : "unknown-email";
  const ipAddress = request.ip || request.socket.remoteAddress || "unknown-ip";

  return `${email}:${ipAddress}`;
};

const loginRateLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  keyGenerator: getLoginRateLimitKey,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({
      message: "Too many failed login attempts. Please wait before trying again."
    });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totpCode: z.string().trim().optional()
});

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
  permissions: z.record(z.boolean()).optional()
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  permissions: z.record(z.boolean()).optional()
});

const resetPasswordSchema = z.object({
  password: z.string().min(8)
});

const totpSchema = z.object({
  code: z.string().min(6).max(6)
});

const serializeUser = (user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  twoFactorEnabled: boolean;
  isActive?: boolean;
  lastLoginAt?: Date | null;
  permissions?: Array<{ permissionKey: string; allowed: boolean }>;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isActive: user.isActive ?? true,
  lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  twoFactorEnabled: user.twoFactorEnabled,
  permissions: Object.fromEntries((user.permissions || []).map((permission) => [permission.permissionKey, permission.allowed]))
});

router.post(
  "/login",
  loginRateLimiter,
  asyncHandler(async (request, response) => {
    const { email, password, totpCode } = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase()
      },
      include: {
        permissions: true
      }
    });

    if (!user || !user.isActive) {
      response.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);

    if (!isValidPassword) {
      response.status(401).json({ message: "Invalid email or password" });
      return;
    }

    if (user.twoFactorEnabled) {
      if (!totpCode || !user.totpSecret || !authenticator.verify({ token: totpCode, secret: user.totpSecret })) {
        response.status(401).json({ message: "A valid 2FA code is required" });
        return;
      }
    }

    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        lastLoginAt: new Date()
      }
    });

    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    });

    setAuthCookie(response, token);
    await createAuditLog({
      userId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      ipAddress: request.ip
    });

    if (user.role === UserRole.ADMIN) {
      runLoginTriggeredSyncCheck().catch(() => undefined);
    }

    response.json({
      user: serializeUser(user),
      cookieName: getAuthCookieName()
    });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (request, response) => {
    clearAuthCookie(response);

    await createAuditLog({
      userId: request.user?.sub,
      action: "auth.logout",
      entityType: "user",
      entityId: request.user?.sub,
      ipAddress: request.ip
    });

    response.status(204).send();
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        id: request.user!.sub
      },
      include: {
        permissions: true
      }
    });

    response.json({
      user: serializeUser(user)
    });
  })
);

router.post(
  "/2fa/setup",
  requireAuth,
  asyncHandler(async (request, response) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        id: request.user!.sub
      }
    });

    const secret = authenticator.generateSecret();
    const appName = "Zap Electrical Dashboard";
    const otpauth = authenticator.keyuri(user.email, appName, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        totpSecret: secret,
        twoFactorEnabled: false
      }
    });

    response.json({
      qrCodeDataUrl,
      manualKey: secret
    });
  })
);

router.post(
  "/2fa/enable",
  requireAuth,
  asyncHandler(async (request, response) => {
    const { code } = totpSchema.parse(request.body);
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        id: request.user!.sub
      }
    });

    if (!user.totpSecret || !authenticator.verify({ token: code, secret: user.totpSecret })) {
      response.status(400).json({ message: "The verification code is invalid" });
      return;
    }

    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        twoFactorEnabled: true
      }
    });

    response.status(204).send();
  })
);

router.post(
  "/2fa/disable",
  requireAuth,
  asyncHandler(async (request, response) => {
    const { code } = totpSchema.parse(request.body);
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        id: request.user!.sub
      }
    });

    if (!user.totpSecret || !authenticator.verify({ token: code, secret: user.totpSecret })) {
      response.status(400).json({ message: "The verification code is invalid" });
      return;
    }

    await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        twoFactorEnabled: false,
        totpSecret: null
      }
    });

    response.status(204).send();
  })
);

router.get(
  "/users",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (_request, response) => {
    const users = await prisma.user.findMany({
      include: {
        permissions: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    response.json({
      users: users.map(serializeUser)
    });
  })
);

router.post(
  "/users",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const payload = createUserSchema.parse(request.body);
    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.user.create({
      data: {
        email: payload.email.toLowerCase(),
        name: payload.name,
        passwordHash,
        role: payload.role,
        permissions: {
          create: Object.entries(payload.permissions || {}).map(([permissionKey, allowed]) => ({
            permissionKey,
            allowed
          }))
        }
      },
      include: {
        permissions: true
      }
    });

    await createAuditLog({
      userId: request.user!.sub,
      action: "user.created",
      entityType: "user",
      entityId: user.id,
      newValue: serializeUser(user),
      ipAddress: request.ip
    });

    response.status(201).json({
      user: serializeUser(user)
    });
  })
);

router.patch(
  "/users/:userId",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const payload = updateUserSchema.parse(request.body);
    const before = await prisma.user.findUniqueOrThrow({
      where: {
        id: request.params.userId
      },
      include: {
        permissions: true
      }
    });

    const user = await prisma.user.update({
      where: {
        id: request.params.userId
      },
      data: {
        name: payload.name,
        role: payload.role,
        isActive: payload.isActive,
        permissions: payload.permissions
          ? {
              upsert: Object.entries(payload.permissions).map(([permissionKey, allowed]) => ({
                where: {
                  userId_permissionKey: {
                    userId: request.params.userId,
                    permissionKey
                  }
                },
                update: {
                  allowed
                },
                create: {
                  permissionKey,
                  allowed
                }
              }))
            }
          : undefined
      },
      include: {
        permissions: true
      }
    });

    await createAuditLog({
      userId: request.user!.sub,
      action: "user.updated",
      entityType: "user",
      entityId: user.id,
      oldValue: serializeUser(before),
      newValue: serializeUser(user),
      ipAddress: request.ip
    });

    response.json({
      user: serializeUser(user)
    });
  })
);

router.post(
  "/users/:userId/reset-password",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (request, response) => {
    const { password } = resetPasswordSchema.parse(request.body);
    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: {
        id: request.params.userId
      },
      data: {
        passwordHash
      }
    });

    await createAuditLog({
      userId: request.user!.sub,
      action: "user.password_reset",
      entityType: "user",
      entityId: request.params.userId,
      ipAddress: request.ip
    });

    response.status(204).send();
  })
);

export { router as authRouter };
