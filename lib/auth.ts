import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "challenge_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const SCRYPT_KEY_LENGTH = 64;

function getAuthSecret() {
  return process.env.AUTH_SECRET || "dev-auth-secret-change-me";
}

function signPayload(payload: string) {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, hash] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  const hashBuffer = Buffer.from(hash, "hex");

  if (hashBuffer.length !== derivedKey.length) return false;

  return timingSafeEqual(hashBuffer, derivedKey);
}

function createSessionToken(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function parseSessionToken(token: string) {
  const [userId, expiresAtRaw, signature] = token.split(".");
  if (!userId || !expiresAtRaw || !signature) return null;

  const payload = `${userId}.${expiresAtRaw}`;
  const expectedSignature = signPayload(payload);
  if (signature !== expectedSignature) return null;

  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (Number.isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;

  return { userId };
}

export async function setSession(userId: string) {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const parsed = parseSessionToken(token);
  if (!parsed) return null;

  return prisma.user.findUnique({
    where: { id: parsed.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isSuperUser: true,
    },
  });
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    isSuperUser: user.isSuperUser,
  };
}
