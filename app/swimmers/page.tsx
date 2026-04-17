import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSessionUser } from "@/lib/auth";
import { requireAccessBeforeClosure, requirePreferredChallengeForUser } from "@/lib/access";
import { ARCHIVED_READ_ONLY_MESSAGE, assertChallengeWritable, ensureActiveChallenge, syncOrganizerClubForChallenge } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { BackToMainMenuLink } from "@/app/back-to-main-menu-link";
import { SwimmerCreateForm } from "./swimmer-create-form";

function buildSwimmersPrintHref(query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  return `/swimmers/print${params.size > 0 ? `?${params.toString()}` : ""}`;
}

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

  const user = await requireSessionUser();
  const challenge = await requirePreferredChallengeForUser(user);
  await assertChallengeWritable(challenge.id);
  const fallbackNextNumber = await getNextSwimmerNumber(challenge.id);

  const clubId = String(formData.get("clubId") || "") || null;
  const sectionId = String(formData.get("sectionId") || "") || null;

  if (clubId) {
    const participantClub = await prisma.challengeClub.findUnique({
      where: {
        challengeId_clubId: {
          challengeId: challenge.id,
          clubId,
        },
      },
      select: { clubId: true },
    });

    if (!participantClub) {
      return {
        error: "Ce club n'est pas rattaché à l'événement.",
        success: false,
        nextNumber: fallbackNextNumber,
      };
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const number = await getNextSwimmerNumber(challenge.id);

    try {
      await prisma.swimmer.create({
        data: {
          challengeId: challenge.id,
          number,
          firstName: String(formData.get("firstName") || "").trim(),
          lastName: String(formData.get("lastName") || "").trim(),
          email: String(formData.get("email") || "").trim() || undefined,
          clubId,
          sectionId,
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

  const user = await requireSessionUser();
  const challenge = await requirePreferredChallengeForUser(user);
  await assertChallengeWritable(challenge.id);

  const swimmerId = String(formData.get("id") || "").trim();
  if (!swimmerId) return;

  const swimmer = await prisma.swimmer.findUnique({
    where: { id: swimmerId },
    select: { challengeId: true },
  });

  if (!swimmer || swimmer.challengeId !== challenge.id) return;

  const clubId = String(formData.get("clubId") || "") || null;

  if (clubId) {
    const participantClub = await prisma.challengeClub.findUnique({
      where: {
        challengeId_clubId: {
          challengeId: challenge.id,
          clubId,
        },
      },
      select: { clubId: true },
    });

    if (!participantClub) return;
  }

  await prisma.swimmer.update({
    where: { id: swimmerId },
    data: {
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      email: String(formData.get("email") || "").trim() || null,
      clubId,
      sectionId: String(formData.get("sectionId") || "") || null,
    },
  });

  revalidatePath("/swimmers");
}

async function deleteSwimmer(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const user = await requireSessionUser();
  const challenge = await requirePreferredChallengeForUser(user);
  await assertChallengeWritable(challenge.id);

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

  const user = await requireSessionUser();
  const challenge = await requirePreferredChallengeForUser(user);
  await assertChallengeWritable(challenge.id);

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const club = await prisma.club.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  await prisma.challengeClub.upsert({
    where: {
      challengeId_clubId: {
        challengeId: challenge.id,
        clubId: club.id,
      },
    },
    update: {},
    create: {
      challengeId: challenge.id,
      clubId: club.id,
    },
  });

  revalidatePath("/swimmers");
}

async function deleteClub(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const user = await requireSessionUser();
  const challenge = await requirePreferredChallengeForUser(user);
  await assertChallengeWritable(challenge.id);

  await prisma.challengeClub.delete({
    where: {
      challengeId_clubId: {
        challengeId: challenge.id,
        clubId: String(formData.get("id")),
      },
    },
  });
  revalidatePath("/swimmers");
}


async function toggleHostClub(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const user = await requireSessionUser();
  const challenge = await requirePreferredChallengeForUser(user);
  await assertChallengeWritable(challenge.id);

  const clubId = String(formData.get("id") || "").trim();
  if (!clubId) return;

  const linkedClub = await prisma.challengeClub.findUnique({
    where: {
      challengeId_clubId: {
        challengeId: challenge.id,
        clubId,
      },
    },
    include: { club: true },
  });

  if (!linkedClub) return;
  if (linkedClub.club.name === challenge.clubOrganisateur) return;

  await prisma.challengeClub.delete({
    where: {
      challengeId_clubId: {
        challengeId: challenge.id,
        clubId,
      },
    },
  });

  revalidatePath("/swimmers");
}

async function createSection(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const user = await requireSessionUser();
  const challenge = await requirePreferredChallengeForUser(user);
  await assertChallengeWritable(challenge.id);

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  await prisma.section.create({ data: { name } });
  revalidatePath("/swimmers");
}

async function deleteSection(formData: FormData) {
  "use server";

  if (!hasDatabaseUrl) return;

  const user = await requireSessionUser();
  const challenge = await requirePreferredChallengeForUser(user);
  await assertChallengeWritable(challenge.id);

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
        <BackToMainMenuLink />
        <h1 className="text-3xl font-semibold">Nageurs</h1>
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
          Définissez la variable DATABASE_URL pour activer le CRUD nageurs/clubs/sections.
        </div>
      </div>
    );
  }

  try {
    const user = await requireSessionUser();
    await requireAccessBeforeClosure(user);
    const challenge = await requirePreferredChallengeForUser(user);
    const isArchived = challenge.isArchived;
    const organizerClub = await syncOrganizerClubForChallenge(challenge.id, challenge.clubOrganisateur);

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

    const [swimmers, swimmersCount, challengeClubs, sections, nextSwimmerNumber] = await Promise.all([
      prisma.swimmer.findMany({
        where: searchFilter,
        include: { club: true, section: true },
        orderBy: [{ number: "asc" }],
        skip: (currentPage - 1) * SWIMMERS_PER_PAGE,
        take: SWIMMERS_PER_PAGE,
      }),
      prisma.swimmer.count({ where: searchFilter }),
      prisma.challengeClub.findMany({
        where: { challengeId: challenge.id },
        include: { club: true },
        orderBy: { club: { name: "asc" } },
      }),
      prisma.section.findMany({ orderBy: { name: "asc" } }),
      getNextSwimmerNumber(challenge.id),
    ]);

    const clubs = challengeClubs.map(({ club }) => club);
    const defaultClubId = organizerClub?.id ?? "";

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
      <BackToMainMenuLink />
      <h1 className="text-3xl font-semibold">Nageurs</h1>

      {isArchived ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {ARCHIVED_READ_ONLY_MESSAGE}
        </div>
      ) : null}

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-xl font-medium">Créer un nageur</h2>
        <SwimmerCreateForm
          clubs={clubs}
          sections={sections}
          defaultNumber={nextSwimmerNumber}
          action={createSwimmer}
          defaultClubId={defaultClubId}
          disabled={isArchived}
        />
      </section>

      <section className="rounded border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-medium">Liste des nageurs</h2>
          <div className="flex items-center gap-2">
            <a
              href="/statistics"
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Voir Statistique
            </a>
            <a
              href={buildSwimmersPrintHref(query)}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Imprimer tableau nageur
            </a>
            <form className="flex gap-2" method="get">
            <input
              name="q"
              defaultValue={query}
              placeholder="Recherche #, nom, prénom"
              className="rounded border p-2"
            />
            <button type="submit" disabled={isArchived} className="rounded bg-slate-800 px-3 text-white disabled:cursor-not-allowed disabled:bg-slate-400">
              Rechercher
            </button>
            </form>
          </div>
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
              <input name="firstName" defaultValue={swimmer.firstName} required disabled={isArchived} className="rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" />
              <input name="lastName" defaultValue={swimmer.lastName} required disabled={isArchived} className="rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" />
              <input name="email" type="email" defaultValue={swimmer.email ?? ""} disabled={isArchived} className="rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" />
              <select name="clubId" defaultValue={swimmer.clubId ?? ""} disabled={isArchived} className="rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="">Sans club</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
              <select name="sectionId" defaultValue={swimmer.sectionId ?? ""} disabled={isArchived} className="rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="">Sans section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={isArchived} className="rounded bg-emerald-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400">
                Enregistrer
              </button>
              <button
                formAction={deleteSwimmer}
                type="submit"
                className="rounded bg-red-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400" disabled={isArchived}
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
            <input name="name" placeholder="Nouveau club" disabled={isArchived} className="w-full rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" required />
            <button type="submit" disabled={isArchived} className="rounded bg-slate-800 px-3 text-white disabled:cursor-not-allowed disabled:bg-slate-400">
              +
            </button>
          </form>
          <ul className="space-y-2">
            {clubs.map((club) => {
              const isOrganizerClub = club.name === challenge.clubOrganisateur;

              return (
                <li key={club.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span>{club.name}</span>
                    {isOrganizerClub ? <span className="text-xs font-medium text-emerald-700">(organisateur)</span> : null}
                  </div>
                  <form action={deleteClub}>
                    <input type="hidden" name="id" value={club.id} />
                    <button className="rounded bg-red-600 px-2 py-1 text-white disabled:cursor-not-allowed disabled:bg-slate-400" type="submit" disabled={isArchived || isOrganizerClub}>
                      Supprimer
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded border bg-white p-4">
          <h2 className="mb-3 text-xl font-medium">Sections</h2>
          <form action={createSection} className="mb-3 flex gap-2">
            <input name="name" placeholder="Nouvelle section" disabled={isArchived} className="w-full rounded border p-2 disabled:cursor-not-allowed disabled:bg-slate-100" required />
            <button type="submit" disabled={isArchived} className="rounded bg-slate-800 px-3 text-white disabled:cursor-not-allowed disabled:bg-slate-400">
              +
            </button>
          </form>
          <ul className="space-y-2">
            {sections.map((section) => (
              <li key={section.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <span>{section.name}</span>
                <form action={deleteSection}>
                  <input type="hidden" name="id" value={section.id} />
                  <button className="rounded bg-red-600 px-2 py-1 text-white disabled:cursor-not-allowed disabled:bg-slate-400" type="submit" disabled={isArchived}>
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
