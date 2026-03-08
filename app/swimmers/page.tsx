import { revalidatePath } from "next/cache";
import { DEFAULT_CHALLENGE_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

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

async function ensureDefaultChallenge() {
  return prisma.challenge.upsert({
    where: { id: DEFAULT_CHALLENGE_ID },
    update: {},
    create: {
      id: DEFAULT_CHALLENGE_ID,
      name: "Challenge Apnée V1",
      eventDate: new Date(),
      durationMinutes: 120,
    },
  });
}

async function createSwimmer(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const challenge = await ensureDefaultChallenge();

  await prisma.swimmer.create({
    data: {
      challengeId: challenge.id,
      number: Number(formData.get("number")),
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      clubId: String(formData.get("clubId") || "") || null,
      sectionId: String(formData.get("sectionId") || "") || null,
    },
  });

  revalidatePath("/swimmers");
}

async function updateSwimmer(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  await prisma.swimmer.update({
    where: { id: String(formData.get("id")) },
    data: {
      number: Number(formData.get("number")),
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      clubId: String(formData.get("clubId") || "") || null,
      sectionId: String(formData.get("sectionId") || "") || null,
    },
  });

  revalidatePath("/swimmers");
}

async function deleteSwimmer(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  await prisma.swimmer.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/swimmers");
}

async function createClub(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  await prisma.club.create({
    data: {
      name,
      isHostClub: Boolean(formData.get("isHostClub")),
    },
  });

  revalidatePath("/swimmers");
}

async function deleteClub(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  await prisma.club.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/swimmers");
}

async function createSection(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  await prisma.section.create({ data: { name } });
  revalidatePath("/swimmers");
}

async function deleteSection(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  await prisma.section.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/swimmers");
}

export default async function SwimmersPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const query = searchParams?.q?.trim() ?? "";

  if (!hasDatabaseUrl) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Nageurs</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Définissez la variable DATABASE_URL pour activer le CRUD nageurs/clubs/sections.
        </div>
      </div>
    );
  }

  try {
    const challenge = await ensureDefaultChallenge();

    const searchNumber = Number(query);
    const hasSearchNumber = !Number.isNaN(searchNumber);

    const [swimmers, clubs, sections] = await Promise.all([
      prisma.swimmer.findMany({
        where: {
          challengeId: challenge.id,
          ...(query
            ? {
                OR: [
                  { firstName: { contains: query, mode: "insensitive" } },
                  { lastName: { contains: query, mode: "insensitive" } },
                  ...(hasSearchNumber ? [{ number: searchNumber }] : []),
                ],
              }
            : {}),
        },
        include: { club: true, section: true },
        orderBy: [{ number: "asc" }],
      }),
      prisma.club.findMany({ orderBy: { name: "asc" } }),
      prisma.section.findMany({ orderBy: { name: "asc" } }),
    ]);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold">Nageurs</h1>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-xl font-medium">Créer un nageur</h2>
        <form action={createSwimmer} className="grid gap-3 md:grid-cols-6">
          <input name="number" type="number" placeholder="Numéro" required className="rounded border p-2" />
          <input name="firstName" placeholder="Prénom" required className="rounded border p-2" />
          <input name="lastName" placeholder="Nom" required className="rounded border p-2" />
          <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
          <select name="clubId" className="rounded border p-2">
            <option value="">Sans club</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
          <select name="sectionId" className="rounded border p-2">
            <option value="">Sans section</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-blue-600 p-2 text-white md:col-span-6">
            Ajouter
          </button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-4">
          <h2 className="mb-3 text-xl font-medium">Clubs</h2>
          <form action={createClub} className="mb-3 flex gap-2">
            <input name="name" placeholder="Nouveau club" className="w-full rounded border p-2" required />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="isHostClub" />
              Host
            </label>
            <button type="submit" className="rounded bg-slate-800 px-3 text-white">
              +
            </button>
          </form>
          <ul className="space-y-2">
            {clubs.map((club) => (
              <li key={club.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <span>
                  {club.name} {club.isHostClub ? "(organisateur)" : ""}
                </span>
                <form action={deleteClub}>
                  <input type="hidden" name="id" value={club.id} />
                  <button className="rounded bg-red-600 px-2 py-1 text-white" type="submit">
                    Supprimer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded border bg-white p-4">
          <h2 className="mb-3 text-xl font-medium">Sections</h2>
          <form action={createSection} className="mb-3 flex gap-2">
            <input name="name" placeholder="Nouvelle section" className="w-full rounded border p-2" required />
            <button type="submit" className="rounded bg-slate-800 px-3 text-white">
              +
            </button>
          </form>
          <ul className="space-y-2">
            {sections.map((section) => (
              <li key={section.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <span>{section.name}</span>
                <form action={deleteSection}>
                  <input type="hidden" name="id" value={section.id} />
                  <button className="rounded bg-red-600 px-2 py-1 text-white" type="submit">
                    Supprimer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-medium">Liste des nageurs</h2>
          <form className="flex gap-2" method="get">
            <input
              name="q"
              defaultValue={query}
              placeholder="Recherche #, nom, prénom"
              className="rounded border p-2"
            />
            <button type="submit" className="rounded bg-slate-800 px-3 text-white">
              Rechercher
            </button>
          </form>
        </div>
        <div className="space-y-3">
          {swimmers.map((swimmer) => (
            <form key={swimmer.id} action={updateSwimmer} className="grid gap-2 rounded border p-3 md:grid-cols-8">
              <input type="hidden" name="id" value={swimmer.id} />
              <input name="number" type="number" defaultValue={swimmer.number} required className="rounded border p-2" />
              <input name="firstName" defaultValue={swimmer.firstName} required className="rounded border p-2" />
              <input name="lastName" defaultValue={swimmer.lastName} required className="rounded border p-2" />
              <input name="email" type="email" defaultValue={swimmer.email} required className="rounded border p-2" />
              <select name="clubId" defaultValue={swimmer.clubId ?? ""} className="rounded border p-2">
                <option value="">Sans club</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
              <select name="sectionId" defaultValue={swimmer.sectionId ?? ""} className="rounded border p-2">
                <option value="">Sans section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded bg-emerald-600 px-3 py-2 text-white">
                Enregistrer
              </button>
              <button
                formAction={deleteSwimmer}
                type="submit"
                className="rounded bg-red-600 px-3 py-2 text-white"
              >
                Supprimer
              </button>
            </form>
          ))}
          {swimmers.length === 0 ? <p className="text-sm text-slate-500">Aucun nageur trouvé.</p> : null}
        </div>
      </section>
    </div>
  );

  } catch {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Nageurs</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Impossible de se connecter à la base de données. Vérifiez DATABASE_URL.
        </div>
      </div>
    );
  }
}
