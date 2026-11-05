import { PrismaClient } from "@prisma/client";
import { applySeed } from "../src/lib/seed/applySeed";

// Deploy-time seed: loads the synthetic dataset only into an empty database,
// so restarts and redeploys keep existing decisions and audit history.
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  if (users > 0) {
    console.log(`Database already has ${users} users; skipping seed.`);
    return;
  }
  const counts = await applySeed(prisma);
  console.log(`Seeded ${counts.users} users, ${counts.cases} cases, ${counts.auditEvents} audit events.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
