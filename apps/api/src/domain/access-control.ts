export type AccessRole = "ADMIN" | "MANAGER" | "READ_ONLY" | "STAFF";

export type AccessUser = {
  role: AccessRole;
  permissions?: Record<string, boolean>;
};

export const canViewFinancials = (user: AccessUser) =>
  user.role === "ADMIN" ||
  user.role === "MANAGER" ||
  (user.role === "READ_ONLY" && Boolean(user.permissions?.view_financials));

export const canMutate = (user: AccessUser, permissionKey: string) =>
  user.role === "ADMIN" || (user.role !== "STAFF" && Boolean(user.permissions?.[permissionKey]));

export const canViewPnl = (user: AccessUser) =>
  user.role === "ADMIN" ||
  user.role === "MANAGER" ||
  (user.role === "READ_ONLY" && Boolean(user.permissions?.view_pnl));
