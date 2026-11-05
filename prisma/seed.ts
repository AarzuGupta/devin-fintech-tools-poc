import { PrismaClient } from "@prisma/client";
import { applySeed } from "../src/lib/seed/applySeed";

const prisma = new PrismaClient();

applySeed(prisma)
  .then((counts) => console.log(`Seeded ${counts.users} users, ${counts.cases} cases, ${counts.auditEvents} audit events.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
