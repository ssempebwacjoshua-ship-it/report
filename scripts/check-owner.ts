import "dotenv/config";
import { prisma } from "../src/server/db/prisma";

async function main() {
  const u = await prisma.user.findFirst({ where: { email: "owner@schoolconnect.local" } });
  console.log("user found:", !!u);
  if (u) {
    console.log({ id: u.id, email: u.email, isActive: u.isActive, isPlatformOwner: u.isPlatformOwner, mustChangePassword: u.mustChangePassword });
    console.log("passwordHashPresent:", Boolean(u.passwordHash));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
