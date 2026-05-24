import { app } from "./app.js";
import { prisma } from "./config/prisma.js";
import { env } from "./config/env.js";
import { startSyncScheduler } from "./services/scheduler.service.js";

const start = async () => {
  await prisma.$connect();

  app.listen(env.PORT, () => {
    console.log(`Zap Electrical API listening on port ${env.PORT}`);
  });

  if (env.ENABLE_API_SCHEDULER) {
    startSyncScheduler();
  }
};

start().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
