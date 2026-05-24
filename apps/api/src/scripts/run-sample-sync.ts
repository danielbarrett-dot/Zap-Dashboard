import { prisma } from "../config/prisma.js";
import { syncAllProviders } from "../services/sync.service.js";

const run = async () => {
  await syncAllProviders();
  await prisma.$disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
