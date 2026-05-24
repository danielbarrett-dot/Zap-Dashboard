import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import { getAuthCookieName, verifyAuthToken } from "../lib/auth.js";

type Role = "ADMIN" | "MANAGER" | "READ_ONLY" | "STAFF";

export const requireAuth = (request: Request, response: Response, next: NextFunction) => {
  const token = request.cookies[getAuthCookieName()];

  if (!token) {
    response.status(401).json({ message: "Authentication required" });
    return;
  }

  void (async () => {
    try {
      const decoded = verifyAuthToken(token);
      const user = await prisma.user.findUnique({
        where: {
          id: decoded.sub
        },
        include: {
          permissions: true
        }
      });

      if (!user || !user.isActive) {
        response.status(401).json({ message: "Session expired or invalid" });
        return;
      }

      request.user = {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        permissions: Object.fromEntries(
          user.permissions.map((permission) => [permission.permissionKey, permission.allowed])
        )
      };
      next();
    } catch {
      response.status(401).json({ message: "Session expired or invalid" });
    }
  })();
};

export const requireRole =
  (...roles: Role[]) =>
  (request: Request, response: Response, next: NextFunction) => {
    if (!request.user) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    if (!roles.includes(request.user.role)) {
      response.status(403).json({ message: "You do not have permission to access this resource" });
      return;
    }

    next();
  };

export const requirePermission =
  (permissionKey: string) =>
  (request: Request, response: Response, next: NextFunction) => {
    if (!request.user) {
      response.status(401).json({ message: "Authentication required" });
      return;
    }

    if (request.user.role === "ADMIN" || (request.user.role !== "STAFF" && request.user.permissions?.[permissionKey])) {
      next();
      return;
    }

    response.status(403).json({ message: "You do not have permission to access this resource" });
  };
