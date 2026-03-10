"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { type ComparableLine } from "@/lib/verification";

type RoundOption = { id: string; label: string };
type LaneOption = { id: string; code: string; distanceM: number };

type SwimmerOption = {
  id: string;
  number: number;
  firstName: string;
  lastName: string;
};

type SheetRecord = {
  id: string;
  roundId: string;
  laneId: string;
  originalLines: ComparableLine[];
  userVerificationLines: ComparableLine[] | null;
};

type Row = {
  swimmerNumber: string;
  squares: string;
  ticks: string;
};

type SaveState = {
  error: string | null;
  success: string | null;
};

type Props = {
  rounds: RoundOption[];
  lanes: LaneOption[];
  swimmers: SwimmerOption[];
  sheets: SheetRecord[];
  action: (state: SaveState, formData: FormData) => Promise<SaveState>;
};

const EMPTY_ROW: Row = { swimmerNumber: "", squares: "", ticks: "" };

export function VerificationForm({ rounds, lanes, swimmers, sheets, action }: Props) {
  const [state, formAction] = useFormState(action, { error: null, success: null });
  const [roundId, setRoundId] = useState("");
  const [laneId, setLaneId] = useState("");
  const [rows, setRows] = useState<Row[]>([EMPTY_ROW]);

  useEffect(() => {
    if (rounds.length > 0 && !roundId) {
      setRoundId(rounds[0].id);
    }
  }, [roundId, rounds]);

  const selectedSheet = useMemo(() => sheets.find((sheet) => sheet.roundId === roundId && sheet.laneId === laneId) ?? null, [laneId, roundId, sheets]);
  const selectedLane = useMemo(() => lanes.find((lane) => lane.id === laneId) ?? null, [laneId, lanes]);

  useEffect(() => {
    if (!selectedSheet) {
      setRows([EMPTY_ROW]);
      return;
    }

    if (selectedSheet.userVerificationLines && selectedSheet.userVerificationLines.length > 0) {
      setRows(
        selectedSheet.userVerificationLines.map((line) => ({
          swimmerNumber: String(line.swimmerNumber),
          squares: String(line.squares),
          ticks: String(line.ticks),
        })),
      );
      return;
    }

    setRows(
      selectedSheet.originalLines.length > 0
        ? selectedSheet.originalLines.map((line) => ({ swimmerNumber: String(line.swimmerNumber), squares: "", ticks: "" }))
        : [EMPTY_ROW],
    );
  }, [selectedSheet]);

  const swimmerByNumber = useMemo(() => {
    const map = new Map<number, SwimmerOption>();
    for (const swimmer of swimmers) map.set(swimmer.number, swimmer);
    return map;
  }, [swimmers]);

  const normalizedRows = useMemo(() => {
    return rows
      .map((row) => {
        const swimmerNumber = Number.parseInt(row.swimmerNumber, 10);
        const squares = Number.parseInt(row.squares, 10);
        const ticks = Number.parseInt(row.ticks, 10);

        if (Number.isNaN(swimmerNumber) && Number.isNaN(squares) && Number.isNaN(ticks)) {
          return null;
        }

        return {
          swimmerNumber: Number.isNaN(swimmerNumber) ? -1 : swimmerNumber,
          squares: Number.isNaN(squares) ? 0 : squares,
          ticks: Number.isNaN(ticks) ? 0 : ticks,
        };
      })
      .filter((row): row is ComparableLine => row !== null);
  }, [rows]);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((currentRows) => currentRows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const isLocked = !selectedSheet;

  return (
    <form action={formAction} className="space-y-4 rounded border bg-white p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Tournée</span>
          <select name="roundId" value={roundId} onChange={(event) => setRoundId(event.target.value)} className="w-full rounded border p-2">
            <option value="">Sélectionner une tournée</option>
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Ligne</span>
          <select name="laneId" value={laneId} onChange={(event) => setLaneId(event.target.value)} className="w-full rounded border p-2">
            <option value="">Sélectionner une ligne</option>
            {lanes.map((lane) => (
              <option key={lane.id} value={lane.id}>
                {lane.code}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700">Statut feuille</p>
          <p className="rounded border bg-slate-50 p-2 text-slate-800">{selectedSheet?.userVerificationLines ? "MA VÉRIFICATION EXISTE" : "PAS ENCORE VÉRIFIÉE PAR MOI"}</p>
        </div>
      </div>

      {!selectedSheet ? (
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
          Sélectionnez une tournée et une ligne existantes pour charger une feuille à vérifier.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded border">
        <table className={`min-w-full divide-y divide-slate-200 text-sm ${isLocked ? "opacity-60" : ""}`}>
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left">Numéro nageur</th>
              <th className="p-2 text-left">Carrés</th>
              <th className="p-2 text-left">Traits</th>
              <th className="p-2 text-left">Longueurs</th>
              <th className="p-2 text-left">Distance</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => {
              const swimmerNumber = Number.parseInt(row.swimmerNumber, 10);
              const squares = Number.parseInt(row.squares, 10);
              const ticks = Number.parseInt(row.ticks, 10);
              const totalLengths = (Number.isNaN(squares) ? 0 : squares) * 4 + (Number.isNaN(ticks) ? 0 : ticks);
              const distance = selectedLane ? totalLengths * selectedLane.distanceM : 0;
              const swimmer = Number.isNaN(swimmerNumber) ? null : swimmerByNumber.get(swimmerNumber) ?? null;

              return (
                <tr key={`row-${index}`}>
                  <td className="p-2">
                    <input
                      value={row.swimmerNumber}
                      inputMode="numeric"
                      min={1}
                      onChange={(event) => updateRow(index, { swimmerNumber: event.target.value })}
                      disabled={isLocked}
                      className="w-24 rounded border p-1"
                    />
                    <p className="mt-1 text-xs text-slate-500">{swimmer ? `${swimmer.lastName} ${swimmer.firstName}` : row.swimmerNumber ? "Nageur introuvable" : ""}</p>
                  </td>
                  <td className="p-2">
                    <input value={row.squares} inputMode="numeric" min={0} onChange={(event) => updateRow(index, { squares: event.target.value })} disabled={isLocked} className="w-20 rounded border p-1" />
                  </td>
                  <td className="p-2">
                    <input value={row.ticks} inputMode="numeric" min={0} onChange={(event) => updateRow(index, { ticks: event.target.value })} disabled={isLocked} className="w-20 rounded border p-1" />
                  </td>
                  <td className="p-2 text-slate-700">{totalLengths}</td>
                  <td className="p-2 text-slate-700">{distance} m</td>
                  <td className="p-2">
                    <button type="button" onClick={() => setRows((currentRows) => currentRows.filter((_row, i) => i !== index))} disabled={isLocked || rows.length <= 1} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                      Supprimer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <input type="hidden" name="sheetId" value={selectedSheet?.id ?? ""} />
      <input type="hidden" name="linesJson" value={JSON.stringify(normalizedRows)} />

      <button type="button" onClick={() => setRows((currentRows) => [...currentRows, EMPTY_ROW])} disabled={isLocked} className="rounded border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
        Ajouter une ligne
      </button>

      {state.error ? <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{state.success}</p> : null}

      <button type="submit" disabled={isLocked} className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400">
        Enregistrer la vérification
      </button>
    </form>
  );
}
