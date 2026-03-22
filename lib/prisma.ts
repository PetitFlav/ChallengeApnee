import { PrismaClient } from "@prisma/client";

function normalizePostgresConnectionUrl(value: string | undefined) {
  if (!value) return value;

  try {
    new URL(value);
    return value;
  } catch {
    const protocolSeparator = value.indexOf("://");
    if (protocolSeparator === -1) return value;

    const protocol = value.slice(0, protocolSeparator + 3);
    const remainder = value.slice(protocolSeparator + 3);
    const atIndex = remainder.lastIndexOf("@");

    if (atIndex === -1) return value;

    const userInfo = remainder.slice(0, atIndex);
    const hostAndPath = remainder.slice(atIndex + 1);
    const colonIndex = userInfo.indexOf(":");

    if (colonIndex === -1) {
      return `${protocol}${encodeURIComponent(userInfo)}@${hostAndPath}`;
    }

    const username = userInfo.slice(0, colonIndex);
    const password = userInfo.slice(colonIndex + 1);

    return `${protocol}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostAndPath}`;
  }
}

const normalizedDatabaseUrl = normalizePostgresConnectionUrl(process.env.DATABASE_URL);
const normalizedDirectUrl = normalizePostgresConnectionUrl(process.env.DIRECT_URL);

if (normalizedDatabaseUrl) {
  process.env.DATABASE_URL = normalizedDatabaseUrl;
}

if (normalizedDirectUrl) {
  process.env.DIRECT_URL = normalizedDirectUrl;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
