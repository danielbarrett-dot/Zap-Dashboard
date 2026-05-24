import assert from "node:assert/strict";
import test from "node:test";

import type { NextFunction, Request, Response } from "express";

process.env.NODE_ENV ||= "test";
process.env.DATABASE_URL ||= "postgresql://postgres:postgres@localhost:5432/zap_dashboard?schema=public";
process.env.FRONTEND_URL ||= "http://localhost:3000";
process.env.JWT_SECRET ||= "test-secret-that-is-long-enough-for-session-tests";

const runRoleGate = async (role: "ADMIN" | "MANAGER" | "READ_ONLY" | "STAFF", allowedRoles: Parameters<typeof import("../src/middleware/auth.js").requireRole>) => {
  const { requireRole } = await import("../src/middleware/auth.js");
  const request = {
    user: {
      sub: `${role.toLowerCase()}-user`,
      email: `${role.toLowerCase()}@example.test`,
      name: role,
      role,
      permissions: role === "READ_ONLY" ? { view_financials: true, view_pnl: true, view_supplier_invoices: true } : {}
    }
  } as Request;
  const result = {
    nextCalled: false,
    statusCode: 200,
    body: undefined as unknown
  };
  const response = {
    status(code: number) {
      result.statusCode = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    }
  } as Response;
  const next: NextFunction = () => {
    result.nextCalled = true;
  };

  requireRole(...allowedRoles)(request, response, next);

  return result;
};

test("private API middleware emits no-store cache headers before protected handlers run", async () => {
  const { noStorePrivateResponses } = await import("../src/middleware/no-cache.js");
  const headers = new Map<string, string | number | readonly string[]>();
  const response = {
    setHeader(name: string, value: string | number | readonly string[]) {
      headers.set(name.toLowerCase(), value);
      return this;
    }
  } as Response;
  let nextCalled = false;

  noStorePrivateResponses({} as Request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers.get("cache-control"), "no-store, no-cache, must-revalidate, private");
  assert.equal(headers.get("pragma"), "no-cache");
  assert.equal(headers.get("expires"), "0");
  assert.equal(headers.get("surrogate-control"), "no-store");
});

test("logout cookie clearing expires zap_auth immediately without frontend-readable access", async () => {
  const { clearAuthCookie } = await import("../src/lib/auth.js");
  let setCookie = "";
  const response = {
    append(name: string, value: string) {
      if (name.toLowerCase() === "set-cookie") {
        setCookie = value;
      }
      return this;
    }
  } as Response;

  clearAuthCookie(response);

  assert.match(setCookie, /^zap_auth=;/);
  assert.match(setCookie, /Max-Age=0/i);
  assert.match(setCookie, /Path=\//i);
  assert.match(setCookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.doesNotMatch(setCookie, /Secure/i);
  assert.doesNotMatch(setCookie, /Max-Age=43200/i);
});

test("staff is blocked from restricted financial, supplier, admin, and sync endpoints", async () => {
  const protectedReads: Array<Parameters<typeof import("../src/middleware/auth.js").requireRole>> = [
    ["ADMIN", "MANAGER", "READ_ONLY"],
    ["ADMIN", "MANAGER"],
    ["ADMIN"]
  ];

  for (const allowedRoles of protectedReads) {
    const result = await runRoleGate("STAFF", allowedRoles);
    assert.equal(result.statusCode, 403);
    assert.equal(result.nextCalled, false);
  }
});

test("read only users are blocked from write actions", async () => {
  const writeActions: Array<Parameters<typeof import("../src/middleware/auth.js").requireRole>> = [
    ["ADMIN"],
    ["ADMIN"],
    ["ADMIN"],
    ["ADMIN"]
  ];

  for (const allowedRoles of writeActions) {
    const result = await runRoleGate("READ_ONLY", allowedRoles);
    assert.equal(result.statusCode, 403);
    assert.equal(result.nextCalled, false);
  }
});

test("admin can access protected read and write routes", async () => {
  const protectedRoutes: Array<Parameters<typeof import("../src/middleware/auth.js").requireRole>> = [
    ["ADMIN", "MANAGER", "READ_ONLY"],
    ["ADMIN", "MANAGER"],
    ["ADMIN"]
  ];

  for (const allowedRoles of protectedRoutes) {
    const result = await runRoleGate("ADMIN", allowedRoles);
    assert.equal(result.statusCode, 200);
    assert.equal(result.nextCalled, true);
  }
});
