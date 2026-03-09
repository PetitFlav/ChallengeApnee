import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { DEFAULT_CHALLENGE_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { SwimmerCreateForm } from "./swimmer-create-form";

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

function isPrismaConnectivityError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1000", "P1001", "P1002", "P1017"].includes(error.code);
  }

  return false;
}

function formatErrorForServerLog(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: error };
}

async function ensureDefaultChallenge() {
  return prisma.challenge.upsert({
    where: { id: DEFAULT_CHALLENGE_ID },
    update: {},
    create: {
      id: DEFAULT_CHALLENGE_ID,
      name: "Challenge Apnée V1",
      eventDate: new Date(),
      startTime: "09:30",
      durationMinutes: 120,
      roundsCount: 4,
      lanes25Count: 4,
      lanes50Count: 6,
    },
  });
}

type CreateSwimmerState = {
  error: string | null;
  success: boolean;
  nextNumber: number;
};

const SWIMMERS_PER_PAGE = 10;

async function getNextSwimmerNumber(challengeId: string) {
  const currentMax = await prisma.swimmer.aggregate({
    where: { challengeId },
    _max: { number: true },
  });

  return (currentMax._max.number ?? 0) + 1;
}

async function createSwimmer(_prevState: CreateSwimmerState, formData: FormData): Promise<CreateSwimmerState> {
  "use server";

  if (!hasDatabaseUrl) {
    return {
      error: "Base de données indisponible.",
      success: false,
      nextNumber: 1,
    };
  }

  const challenge = await ensureDefaultChallenge();
  const fallbackNextNumber = await getNextSwimmerNumber(challenge.id);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const number = await getNextSwimmerNumber(challenge.id);

    try {
      await prisma.swimmer.create({
        data: {
          challengeId: challenge.id,
          number,
          firstName: String(formData.get("firstName") || "").trim(),
          lastName: String(formData.get("lastName") || "").trim(),
          email: String(formData.get("email") || "").trim(),
          clubId: String(formData.get("clubId") || "") || null,
          sectionId: String(formData.get("sectionId") || "") || null,
        },
      });

      const nextNumber = await getNextSwimmerNumber(challenge.id);

      revalidatePath("/swimmers");

      return {
        error: null,
        success: true,
        nextNumber,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }

      return {
        error: "Impossible de créer le nageur. Vérifiez les données et réessayez.",
        success: false,
        nextNumber: fallbackNextNumber,
      };
    }
  }

  return {
    error: "Impossible de créer le nageur. Réessayez.",
    success: false,
    nextNumber: await getNextSwimmerNumber(challenge.id),
  };
}

async function updateSwimmer(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  await prisma.swimmer.update({
    where: { id: String(formData.get("id")) },
    data: {
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

  const swimmerId = String(formData.get("id") || "").trim();
  if (!swimmerId) return;

  await prisma.$transaction(async (tx) => {
    const swimmerToDelete = await tx.swimmer.findUnique({
      where: { id: swimmerId },
      select: { id: true, challengeId: true, number: true },
    });

    if (!swimmerToDelete) return;

    await tx.swimmer.delete({ where: { id: swimmerToDelete.id } });

    await tx.swimmer.updateMany({
      where: {
        challengeId: swimmerToDelete.challengeId,
        number: { gt: swimmerToDelete.number },
      },
      data: {
        number: { decrement: 1 },
      },
    });
  });

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
  searchParams?: { q?: string; page?: string };
}) {
  const query = searchParams?.q?.trim() ?? "";
  const currentPage = Math.max(Number(searchParams?.page) || 1, 1);

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

    const searchFilter = {
      challengeId: challenge.id,
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" as const } },
              { lastName: { contains: query, mode: "insensitive" as const } },
              ...(hasSearchNumber ? [{ number: searchNumber }] : []),
            ],
          }
        : {}),
    };

    const [swimmers, swimmersCount, clubs, sections, nextSwimmerNumber] = await Promise.all([
      prisma.swimmer.findMany({
        where: searchFilter,
        include: { club: true, section: true },
        orderBy: [{ number: "asc" }],
        skip: (currentPage - 1) * SWIMMERS_PER_PAGE,
        take: SWIMMERS_PER_PAGE,
      }),
      prisma.swimmer.count({ where: searchFilter }),
      prisma.club.findMany({ orderBy: { name: "asc" } }),
      prisma.section.findMany({ orderBy: { name: "asc" } }),
      getNextSwimmerNumber(challenge.id),
    ]);

    const totalPages = Math.max(Math.ceil(swimmersCount / SWIMMERS_PER_PAGE), 1);
    const hasPreviousPage = currentPage > 1;
    const hasNextPage = currentPage < totalPages;

    const pageHref = (page: number) => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("page", String(page));
      return `/swimmers?${params.toString()}`;
    };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold">Nageurs</h1>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-xl font-medium">Créer un nageur</h2>
        <SwimmerCreateForm
          clubs={clubs}
          sections={sections}
          defaultNumber={nextSwimmerNumber}
          action={createSwimmer}
        />
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
              <input
                value={swimmer.number}
                readOnly
                aria-label="Numéro"
                className="rounded border bg-slate-100 p-2 text-slate-700"
              />
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

        <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
          <p>
            Page {currentPage} / {totalPages}
          </p>
          <div className="flex gap-2">
            {hasPreviousPage ? (
              <a href={pageHref(currentPage - 1)} className="rounded border px-3 py-1">
                Précédente
              </a>
            ) : (
              <span className="rounded border px-3 py-1 text-slate-400">Précédente</span>
            )}
            {hasNextPage ? (
              <a href={pageHref(currentPage + 1)} className="rounded border px-3 py-1">
                Suivante
              </a>
            ) : (
              <span className="rounded border px-3 py-1 text-slate-400">Suivante</span>
            )}
          </div>
        </div>
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

    </div>
  );

  } catch (error) {
    console.error("[swimmers/page] Prisma read failed", formatErrorForServerLog(error));

    const isConnectivityIssue = isPrismaConnectivityError(error);
    const errorMessage = isConnectivityIssue
      ? "Impossible de se connecter à la base de données. Vérifiez DATABASE_URL."
      : "Une erreur est survenue lors du chargement des nageurs. Consultez les logs serveur.";

    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Nageurs</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          {errorMessage}
        </div>
      </div>
    );
  }
}
