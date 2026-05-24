import cron from "node-cron";
import { SyncProvider } from "@prisma/client";

import { env } from "../config/env.js";
import { syncProvider } from "./sync.service.js";

export const startSyncScheduler = () => {
  cron.schedule(env.SERVICEM8_SYNC_CRON, async () => {
    try {
      await syncProvider(SyncProvider.SERVICEM8);
    } catch (error) {
      console.error("Scheduled ServiceM8 sync failed", error);
    }
  });

  cron.schedule(env.QUICKBOOKS_SYNC_CRON, async () => {
    try {
      await syncProvider(SyncProvider.QUICKBOOKS);
    } catch (error) {
      console.error("Scheduled QuickBooks sync failed", error);
    }
  });
};

