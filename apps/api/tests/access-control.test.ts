import assert from "node:assert/strict";
import test from "node:test";

import { canMutate, canViewFinancials, canViewPnl } from "../src/domain/access-control.js";

test("staff cannot view financials or mutate protected workflows", () => {
  const staff = { role: "STAFF" as const, permissions: { view_financials: true, manage_users: true } };

  assert.equal(canViewFinancials(staff), false);
  assert.equal(canViewPnl(staff), false);
  assert.equal(canMutate(staff, "manage_users"), false);
});

test("read-only users need explicit P&L and financial permissions", () => {
  assert.equal(canViewFinancials({ role: "READ_ONLY", permissions: {} }), false);
  assert.equal(canViewPnl({ role: "READ_ONLY", permissions: { view_pnl: true } }), true);
});

test("admins can access protected workflows", () => {
  assert.equal(canViewFinancials({ role: "ADMIN" }), true);
  assert.equal(canMutate({ role: "ADMIN" }, "manual_match"), true);
});
