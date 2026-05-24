import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";

export const notFoundHandler = (_request: Request, response: Response) => {
  response.status(404).json({ message: "Route not found" });
};

export const errorHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Validation error",
      issues: error.flatten()
    });
    return;
  }

  if (error instanceof Error) {
    response.status(500).json({
      message: env.isProduction ? "Something went wrong" : error.message
    });
    return;
  }

  response.status(500).json({ message: "Unexpected error" });
};
