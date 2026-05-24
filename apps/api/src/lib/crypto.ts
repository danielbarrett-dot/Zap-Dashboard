import crypto from "node:crypto";

import { env } from "../config/env.js";

const getKey = () => {
  if (!env.APP_ENCRYPTION_KEY) {
    return null;
  }

  try {
    const key = Buffer.from(env.APP_ENCRYPTION_KEY, "base64");

    if (key.length !== 32) {
      throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes");
    }

    return key;
  } catch {
    throw new Error("APP_ENCRYPTION_KEY must be base64 encoded");
  }
};

export const encryptValue = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const key = getKey();

  if (!key) {
    return value;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
};

export const decryptValue = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const key = getKey();

  if (!key || !value.includes(".")) {
    return value;
  }

  const [ivText, authTagText, encryptedText] = value.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivText, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTagText, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
};
