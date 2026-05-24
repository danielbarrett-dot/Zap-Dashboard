import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { noStorePrivateResponses } from "./middleware/no-cache.js";
import { adminRouter } from "./routes/admin.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { matchesRouter } from "./routes/matches.routes.js";
import { supplierInvoicesRouter } from "./routes/supplier-invoices.routes.js";
import { syncRouter } from "./routes/sync.routes.js";

export const app = express();

app.set("trust proxy", 1);
app.disable("etag");

app.use(
  pinoHttp({
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie"],
      remove: true
    }
  })
);
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_request, response) => {
  response.json({
    ok: true
  });
});

app.use("/api", noStorePrivateResponses);
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/supplier-invoices", supplierInvoicesRouter);
app.use("/api/sync", syncRouter);
app.use("/api/admin", adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);
