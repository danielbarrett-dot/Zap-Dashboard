import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { CookieOptions, Response } from "express";

import { env } from "../config/env.js";

const AUTH_COOKIE = "zap_auth";

export type AuthTokenPayload = {
  sub: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "READ_ONLY" | "STAFF";
  name: string;
  permissions?: Record<string, boolean>;
};

export const hashPassword = async (password: string) => bcrypt.hash(password, 12);

export const comparePassword = async (password: string, passwordHash: string) =>
  bcrypt.compare(password, passwordHash);

export const signAuthToken = (payload: AuthTokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  });

export const verifyAuthToken = (token: string) =>
  jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;

const buildBaseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProduction,
  domain: env.COOKIE_DOMAIN,
  path: "/"
});

const buildLoginCookieOptions = (): CookieOptions => ({
  ...buildBaseCookieOptions(),
  maxAge: 1000 * 60 * 60 * 12
});

const buildClearCookieHeader = () => {
  const options = buildBaseCookieOptions();
  const parts = [
    `${AUTH_COOKIE}=`,
    "Max-Age=0",
    `Path=${options.path}`,
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

export const setAuthCookie = (response: Response, token: string) => {
  response.cookie(AUTH_COOKIE, token, buildLoginCookieOptions());
};

export const clearAuthCookie = (response: Response) => {
  response.append("Set-Cookie", buildClearCookieHeader());
};

export const getAuthCookieName = () => AUTH_COOKIE;
