"use client";

import { useMemo, useState } from "react";
import type { DashboardSwimmerStatus, DashboardVerificationStatus } from "@/lib/verification";

type VerificationDetailRow = {
  verificationId: string;
  verificationLineId: string;
  verifierName: string;
  squares: number;
  ticks: number;
  totalLengths: number;
  distanceM: number;
  createdAtLabel: string;
};

type FinalSelection = {
  source: "original" | "verification" | "manual";
  sourceVerificationId: string | null;
  sourceVerificationLineId: string | null;
  sourceSheetEntryId: string | null;
  squares: number;
  ticks: number;
  totalLengths: number;
  distanceM: number;
  validatedAtLabel: string;
  validatedByName: string;
};

type SwimmerRow = {
  swimmerKey: string;
  swimmerId: string;
  sheetId: string;
  roundId: string;
  laneId: string;
  swimmerNumber: number;
  lastName: string;
  firstName: string;
  club: string;
  section: string;
  status: DashboardSwimmerStatus;
  hasDifferences: boolean;
  originalEntry: {
    sheetEntryId: string;
    squares: number;
    ticks: number;
    totalLengths: number;
    distanceM: number;
  } | null;
  verificationDetails: VerificationDetailRow[];
  finalSelection: FinalSelection | null;
};

type LaneRow = {
  laneId: string;
  laneCode: string;
  distanceM: number;
  swimmersCount: number;
  verificationsCount: number;
  differencesCount: number;
  status: DashboardVerificationStatus;
  swimmers: SwimmerRow[];
};

type RoundRow = {
  roundId: string;
  roundLabel: string;
  lanesCount: number;
  verificationsCount: number;
  verifiersCount: number;
  differencesCount: number;
  status: DashboardVerificationStatus;
  lanes: LaneRow[];
};

export function VerificationDashboard({
  rounds,
  saveFinalResultAction,
}: {
  rounds: RoundRow[];
  saveFinalResultAction: (formData: FormData) => Promise<void>;
}) {
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [selectedSwimmer, setSelectedSwimmer] = useState<SwimmerRow | null>(null);

  const selectedRound = useMemo(() => rounds.find((round) => round.roundId === selectedRoundId) ?? null, [rounds, selectedRoundId]);

  const selectedLane = useMemo(
    () => selectedRound?.lanes.find((lane) => lane.laneId === selectedLaneId) ?? null,
    [selectedLaneId, selectedRound],
  );

  return (
    <section className="space-y-4 rounded border bg-white p-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Contrôle des vérifications</h2>
        <p className="text-sm text-slate-600">Navigation en 3 niveaux : tournée → ligne → nageurs.</p>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left">Tournée</th>
              <th className="p-2 text-left">Nb lignes</th>
              <th className="p-2 text-left">Nb vérifications</th>
              <th className="p-2 text-left">Nb vérificateurs</th>
              <th className="p-2 text-left">Nb différences</th>
              <th className="p-2 text-left">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rounds.map((round) => (
              <tr
                key={round.roundId}
                role="button"
                tabIndex={0}
                className={selectedRoundId === round.roundId ? "cursor-pointer bg-blue-50" : "cursor-pointer hover:bg-slate-50"}
                onClick={() => {
                  setSelectedRoundId(round.roundId);
                  setSelectedLaneId(null);
                  setSelectedSwimmer(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setSelectedRoundId(round.roundId);
                    setSelectedLaneId(null);
                    setSelectedSwimmer(null);
                  }
                }}
              >
                <td className="p-2 font-medium text-blue-700">{round.roundLabel}</td>
                <td className="p-2">{round.lanesCount}</td>
                <td className="p-2">{round.verificationsCount}</td>
                <td className="p-2">{round.verifiersCount}</td>
                <td className="p-2">{round.differencesCount}</td>
                <td className="p-2">{round.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRound ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Niveau 2 · Lignes de {selectedRound.roundLabel}</h3>
          <div className="overflow-x-auto rounded border">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 text-left">Ligne</th>
                  <th className="p-2 text-left">Distance</th>
                  <th className="p-2 text-left">Nb nageurs</th>
                  <th className="p-2 text-left">Nb vérifications</th>
                  <th className="p-2 text-left">Nb différences</th>
                  <th className="p-2 text-left">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedRound.lanes.map((lane) => (
                  <tr
                    key={lane.laneId}
                    role="button"
                    tabIndex={0}
                    className={selectedLaneId === lane.laneId ? "cursor-pointer bg-blue-50" : "cursor-pointer hover:bg-slate-50"}
                    onClick={() => {
                      setSelectedLaneId(lane.laneId);
                      setSelectedSwimmer(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        setSelectedLaneId(lane.laneId);
                        setSelectedSwimmer(null);
                      }
                    }}
                  >
                    <td className="p-2 font-medium text-blue-700">{lane.laneCode}</td>
                    <td className="p-2">{lane.distanceM} m</td>
                    <td className="p-2">{lane.swimmersCount}</td>
                    <td className="p-2">{lane.verificationsCount}</td>
                    <td className="p-2">{lane.differencesCount}</td>
                    <td className="p-2">{lane.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {selectedLane ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Niveau 3 · Détail nageurs {selectedLane.laneCode}</h3>
          <div className="overflow-x-auto rounded border">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 text-left">Numéro</th>
                  <th className="p-2 text-left">Nom</th>
                  <th className="p-2 text-left">Prénom</th>
                  <th className="p-2 text-left">Club</th>
                  <th className="p-2 text-left">Section</th>
                  <th className="p-2 text-left">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedLane.swimmers.map((swimmer) => (
                  <tr key={swimmer.swimmerKey}>
                    <td className="p-2">{swimmer.swimmerNumber}</td>
                    <td className="p-2">{swimmer.lastName}</td>
                    <td className="p-2">{swimmer.firstName}</td>
                    <td className="p-2">{swimmer.club}</td>
                    <td className="p-2">{swimmer.section}</td>
                    <td className="p-2">
                      {swimmer.hasDifferences ? (
                        <button
                          type="button"
                          onClick={() => setSelectedSwimmer(swimmer)}
                          className="rounded border border-amber-500 px-2 py-1 text-amber-700 hover:bg-amber-50"
                        >
                          {swimmer.status}
                        </button>
                      ) : (
                        swimmer.status
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {selectedSwimmer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">
                  Validation finale · #{selectedSwimmer.swimmerNumber} {selectedSwimmer.lastName} {selectedSwimmer.firstName}
                </h4>
                <p className="text-sm text-slate-600">
                  Club: {selectedSwimmer.club} · Section: {selectedSwimmer.section}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedSwimmer(null)} className="rounded border px-2 py-1 text-sm">
                Fermer
              </button>
            </div>

            <div className="space-y-3">
              <h5 className="font-semibold">Saisie originale</h5>
              {selectedSwimmer.originalEntry ? (
                <table className="min-w-full divide-y divide-slate-200 rounded border text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 text-left">Carrés</th>
                      <th className="p-2 text-left">Traits</th>
                      <th className="p-2 text-left">Longueurs</th>
                      <th className="p-2 text-left">Distance</th>
                      <th className="p-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2">{selectedSwimmer.originalEntry.squares}</td>
                      <td className="p-2">{selectedSwimmer.originalEntry.ticks}</td>
                      <td className="p-2">{selectedSwimmer.originalEntry.totalLengths}</td>
                      <td className="p-2">{selectedSwimmer.originalEntry.distanceM} m</td>
                      <td className="p-2">
                        <form action={saveFinalResultAction}>
                          <input type="hidden" name="sheetId" value={selectedSwimmer.sheetId} />
                          <input type="hidden" name="roundId" value={selectedSwimmer.roundId} />
                          <input type="hidden" name="laneId" value={selectedSwimmer.laneId} />
                          <input type="hidden" name="swimmerId" value={selectedSwimmer.swimmerId} />
                          <input type="hidden" name="source" value="original" />
                          <input type="hidden" name="sourceSheetEntryId" value={selectedSwimmer.originalEntry.sheetEntryId} />
                          <input type="hidden" name="squares" value={selectedSwimmer.originalEntry.squares} />
                          <input type="hidden" name="ticks" value={selectedSwimmer.originalEntry.ticks} />
                          <input type="hidden" name="totalLengths" value={selectedSwimmer.originalEntry.totalLengths} />
                          <input type="hidden" name="distanceM" value={selectedSwimmer.originalEntry.distanceM} />
                          <button type="submit" className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700">
                            Retenir ce résultat
                          </button>
                        </form>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-600">Aucune ligne de saisie originale disponible.</p>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <h5 className="font-semibold">Vérifications</h5>
              {selectedSwimmer.verificationDetails.length > 0 ? (
                <table className="min-w-full divide-y divide-slate-200 rounded border text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 text-left">Vérificateur</th>
                      <th className="p-2 text-left">Carrés</th>
                      <th className="p-2 text-left">Traits</th>
                      <th className="p-2 text-left">Longueurs</th>
                      <th className="p-2 text-left">Distance</th>
                      <th className="p-2 text-left">Date/heure</th>
                      <th className="p-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSwimmer.verificationDetails.map((line) => (
                      <tr key={line.verificationLineId}>
                        <td className="p-2">{line.verifierName}</td>
                        <td className="p-2">{line.squares}</td>
                        <td className="p-2">{line.ticks}</td>
                        <td className="p-2">{line.totalLengths}</td>
                        <td className="p-2">{line.distanceM} m</td>
                        <td className="p-2">{line.createdAtLabel}</td>
                        <td className="p-2">
                          <form action={saveFinalResultAction}>
                            <input type="hidden" name="sheetId" value={selectedSwimmer.sheetId} />
                            <input type="hidden" name="roundId" value={selectedSwimmer.roundId} />
                            <input type="hidden" name="laneId" value={selectedSwimmer.laneId} />
                            <input type="hidden" name="swimmerId" value={selectedSwimmer.swimmerId} />
                            <input type="hidden" name="source" value="verification" />
                            <input type="hidden" name="sourceVerificationId" value={line.verificationId} />
                            <input type="hidden" name="sourceVerificationLineId" value={line.verificationLineId} />
                            <input type="hidden" name="squares" value={line.squares} />
                            <input type="hidden" name="ticks" value={line.ticks} />
                            <input type="hidden" name="totalLengths" value={line.totalLengths} />
                            <input type="hidden" name="distanceM" value={line.distanceM} />
                            <button type="submit" className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700">
                              Retenir ce résultat
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-600">Aucune vérification disponible pour ce nageur.</p>
              )}
            </div>

            {selectedSwimmer.finalSelection ? (
              <div className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                Résultat final actuel : {selectedSwimmer.finalSelection.source} · {selectedSwimmer.finalSelection.distanceM} m · validé par{" "}
                {selectedSwimmer.finalSelection.validatedByName} le {selectedSwimmer.finalSelection.validatedAtLabel}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
