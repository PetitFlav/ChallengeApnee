import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireSessionUser } from "@/lib/auth";
import { requireSuperUser } from "@/lib/access";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { LogoutButton } from "@/app/logout-button";

export const dynamic = "force-dynamic";

const databaseUrl = process.env.DATABASE_URL;
const hasDatabaseUrl = (() => {
  if (!databaseUrl) return false;
  try {
    new URL(databaseUrl);
    return true;
  } catch {
    return false;
  }
})();

function getChallengeIds(formData: FormData) {
  return formData
    .getAll("challengeIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

async function createUser(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const sessionUser = await requireSessionUser();
  await requireSuperUser(sessionUser);

  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const challengeIds = getChallengeIds(formData);

  if (!firstName || !lastName || !email || !password) return;

  const created = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash: hashPassword(password),
    },
    select: { id: true },
  });

  if (challengeIds.length > 0) {
    await prisma.challengeUser.createMany({
      data: challengeIds.map((challengeId) => ({ userId: created.id, challengeId })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin/users");
}

async function updateUser(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const sessionUser = await requireSessionUser();
  await requireSuperUser(sessionUser);

  const id = String(formData.get("id") || "").trim();
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const challengeIds = getChallengeIds(formData);

  if (!id || !firstName || !lastName || !email) return;

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { isSuperUser: true },
  });

  if (!existingUser) return;

  await prisma.user.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      ...(password ? { passwordHash: hashPassword(password) } : {}),
    },
  });

  await prisma.challengeUser.deleteMany({ where: { userId: id } });
  if (!existingUser.isSuperUser && challengeIds.length > 0) {
    await prisma.challengeUser.createMany({
      data: challengeIds.map((challengeId) => ({ userId: id, challengeId })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin/users");
}

async function deleteUser(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const sessionUser = await requireSessionUser();
  await requireSuperUser(sessionUser);

  const id = String(formData.get("id") || "").trim();
  if (!id || id === sessionUser.id) return;

  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
}

export default async function AdminUsersPage() {
  if (!hasDatabaseUrl) {
    return (
      <div className="space-y-4">
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Gestion des utilisateurs</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Définissez la variable DATABASE_URL pour activer la gestion des utilisateurs.
        </div>
      </div>
    );
  }

  const sessionUser = await requireSessionUser();
  await requireSuperUser(sessionUser);

  const [users, challenges] = await Promise.all([
    prisma.user.findMany({
      include: {
        challenges: {
          include: {
            challenge: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.challenge.findMany({
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <BackToMainMenuLink />
        <LogoutButton />
      </div>

      <div>
        <h1 className="text-3xl font-semibold">Gestion des utilisateurs</h1>
        <p className="text-slate-600">Création, modification, suppression et affiliation aux événements.</p>
      </div>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-xl font-medium">Créer un utilisateur</h2>
        <form action={createUser} className="grid gap-3 md:grid-cols-2">
          <input name="firstName" required placeholder="Prénom" className="rounded border p-2" />
          <input name="lastName" required placeholder="Nom" className="rounded border p-2" />
          <input name="email" required type="email" placeholder="Email" className="rounded border p-2" />
          <input name="password" required type="password" placeholder="Mot de passe" className="rounded border p-2" />
          <div className="md:col-span-2 space-y-2 rounded border p-3">
            <p className="text-sm font-medium text-slate-700">Événements affiliés</p>
            <div className="grid gap-1">
              {challenges.map((challenge) => (
                <label key={challenge.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="challengeIds" value={challenge.id} />
                  <span>{challenge.name}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="md:col-span-2 rounded bg-blue-600 px-4 py-2 text-white">Créer</button>
        </form>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-xl font-medium">Utilisateurs</h2>
        <div className="space-y-3">
          {users.map((user) => {
            const linkedChallengeIds = new Set(user.challenges.map((link) => link.challengeId));
            return (
              <form key={user.id} className="space-y-3 rounded border p-3" action={updateUser}>
                <input type="hidden" name="id" value={user.id} />
                <div className="grid gap-2 md:grid-cols-4">
                  <input name="firstName" defaultValue={user.firstName} required className="rounded border p-2" />
                  <input name="lastName" defaultValue={user.lastName} required className="rounded border p-2" />
                  <input name="email" defaultValue={user.email} required type="email" className="rounded border p-2" />
                  <input name="password" type="password" placeholder="Nouveau mot de passe (optionnel)" className="rounded border p-2" />
                </div>
                {user.isSuperUser ? (
                  <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    Super utilisateur : accès à tous les événements.
                  </p>
                ) : (
                  <div className="space-y-1 rounded border p-3">
                    <p className="text-sm font-medium text-slate-700">Événements affiliés</p>
                    <div className="grid gap-1">
                      {challenges.map((challenge) => (
                        <label key={challenge.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="challengeIds"
                            value={challenge.id}
                            defaultChecked={linkedChallengeIds.has(challenge.id)}
                          />
                          <span>{challenge.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Affiliations actuelles :{" "}
                  {user.challenges.length > 0 ? user.challenges.map((link) => link.challenge.name).join(", ") : "Aucun événement"}
                </p>
                <div className="flex gap-2">
                  <button type="submit" className="rounded bg-emerald-600 px-3 py-2 text-white">Enregistrer</button>
                  <button
                    type="submit"
                    formAction={deleteUser}
                    className="rounded bg-red-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={user.id === sessionUser.id}
                  >
                    Supprimer
                  </button>
                </div>
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}
