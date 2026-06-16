import "dotenv/config";
import { prisma } from "../src/server/db/prisma";
import { verifyPassword } from "../src/server/services/authService";

async function main() {
  const u = await prisma.user.findFirst({ where: { email: "owner@schoolconnect.local" } });
  console.log("user found:", !!u);
  if (u) {
    console.log({ id: u.id, email: u.email, isActive: u.isActive, isPlatformOwner: u.isPlatformOwner, mustChangePassword: u.mustChangePassword });
    const ok = await verifyPassword("Owner@2026!", u.passwordHash);
    console.log("password matches:", ok);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
