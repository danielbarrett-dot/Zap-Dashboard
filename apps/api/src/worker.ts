import { prisma } from "./config/prisma.js";
import { startSyncScheduler } from "./services/scheduler.service.js";

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

const start = async () => {
  await prisma.$connect();
  startSyncScheduler();
  console.log("Zap Electrical sync worker started");

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
};

start().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
