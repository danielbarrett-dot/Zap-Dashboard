import type { NextFunction, Request, Response } from "express";

export const noStorePrivateResponses = (
  _request: Request,
  response: Response,
  next: NextFunction
) => {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
  next();
};
