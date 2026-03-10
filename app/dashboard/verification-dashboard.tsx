"use client";

import { useMemo, useState } from "react";
import type { DashboardSwimmerStatus, DashboardVerificationStatus } from "@/lib/verification";

type SwimmerRow = {
  swimmerKey: string;
  swimmerNumber: number;
  lastName: string;
  firstName: string;
  club: string;
  section: string;
  enteredDistanceM: number;
  verifiedDistanceM: number;
  differenceM: number;
  status: DashboardSwimmerStatus;
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

export function VerificationDashboard({ rounds }: { rounds: RoundRow[] }) {
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);

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
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setSelectedRoundId(round.roundId);
                    setSelectedLaneId(null);
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
                    onClick={() => setSelectedLaneId(lane.laneId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        setSelectedLaneId(lane.laneId);
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
                  <th className="p-2 text-left">Distance saisie</th>
                  <th className="p-2 text-left">Distance vérifiée</th>
                  <th className="p-2 text-left">Différence</th>
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
                    <td className="p-2">{swimmer.enteredDistanceM} m</td>
                    <td className="p-2">{swimmer.verifiedDistanceM} m</td>
                    <td className="p-2">{swimmer.differenceM} m</td>
                    <td className="p-2">{swimmer.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
