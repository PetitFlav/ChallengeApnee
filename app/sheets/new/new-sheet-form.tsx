"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";

type RoundOption = {
  id: string;
  label: string;
  status: "pending" | "active" | "closed";
  isSelectable: boolean;
  opensAtLabel: string;
  closesAtLabel: string;
};

type LaneOption = {
  id: string;
  code: string;
  distanceM: number;
};

type SwimmerOption = {
  id: string;
  number: number;
  firstName: string;
  lastName: string;
  clubName: string;
  sectionName: string;
};

type SheetRow = {
  swimmerNumber: string;
  squares: string;
  ticks: string;
};

type ExistingSheet = {
  id: string;
  roundId: string;
  laneId: string;
  rows: SheetRow[];
};

type CreateSheetState = {
  error: string | null;
  success: string | null;
  loadedSheetId: string | null;
  nextRoundId: string | null;
};

type Props = {
  rounds: RoundOption[];
  lanes: LaneOption[];
  swimmers: SwimmerOption[];
  existingSheets: ExistingSheet[];
  action: (state: CreateSheetState, formData: FormData) => Promise<CreateSheetState>;
  disabled?: boolean;
};

const EMPTY_ROW: SheetRow = {
  swimmerNumber: "",
  squares: "",
  ticks: "",
};

export function NewSheetForm({ rounds, lanes, swimmers, existingSheets, action, disabled = false }: Props) {
  const [state, formAction] = useFormState(action, { error: null, success: null, loadedSheetId: null, nextRoundId: null });
  const [roundId, setRoundId] = useState("");
  const [laneId, setLaneId] = useState("");
  const [rows, setRows] = useState<SheetRow[]>([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]);
  const [loadedMessage, setLoadedMessage] = useState<string | null>(null);
  const [roundSelectionMessage, setRoundSelectionMessage] = useState<string | null>(null);

  const activeRound = useMemo(() => rounds.find((round) => round.status === "active") ?? null, [rounds]);

  const swimmerByNumber = useMemo(() => {
    const map = new Map<number, SwimmerOption>();
    for (const swimmer of swimmers) {
      map.set(swimmer.number, swimmer);
    }
    return map;
  }, [swimmers]);

  const selectedLane = useMemo(() => lanes.find((lane) => lane.id === laneId) ?? null, [laneId, lanes]);

  const selectedSheet = useMemo(
    () => existingSheets.find((sheet) => sheet.roundId === roundId && sheet.laneId === laneId) ?? null,
    [existingSheets, laneId, roundId],
  );

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
      .filter((row): row is { swimmerNumber: number; squares: number; ticks: number } => row !== null);
  }, [rows]);

  const sheetTotalDistance = useMemo(() => {
    if (!selectedLane) return 0;

    return normalizedRows.reduce((total, row) => {
      const totalLengths = row.squares * 4 + row.ticks;
      return total + totalLengths * selectedLane.distanceM;
    }, 0);
  }, [normalizedRows, selectedLane]);

  useEffect(() => {
    if (roundId) return;
    if (!activeRound) return;

    setRoundId(activeRound.id);
  }, [activeRound, roundId]);

  useEffect(() => {
    if (!roundId || !laneId) {
      setLoadedMessage(null);
      return;
    }

    if (!selectedSheet) {
      setRows([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]);
      setLoadedMessage(null);
      return;
    }

    setRows(selectedSheet.rows.length > 0 ? selectedSheet.rows : [EMPTY_ROW]);
    setLoadedMessage("Feuille existante chargée : vous pouvez modifier, supprimer ou ajouter des lignes nageur.");
  }, [laneId, roundId, selectedSheet]);

  useEffect(() => {
    if (!state.success) return;

    if (state.nextRoundId) {
      setRoundId(state.nextRoundId);
      setLaneId("");
      setRows([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]);
      setLoadedMessage(null);
      return;
    }

    if (state.loadedSheetId) {
      setLoadedMessage("Feuille existante mise à jour avec succès.");
      return;
    }

    setRoundId("");
    setLaneId("");
    setRows([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]);
    setLoadedMessage(null);
  }, [state.loadedSheetId, state.nextRoundId, state.success]);

  function updateRow(index: number, patch: Partial<SheetRow>) {
    setRows((previousRows) => previousRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  const hasInProgressSheet = Boolean(roundId && laneId && normalizedRows.length > 0);
  const isEntryLocked = disabled || !roundId || !laneId;

  function handleRoundChange(nextRoundId: string) {
    const targetRound = rounds.find((round) => round.id === nextRoundId);

    if (targetRound && !targetRound.isSelectable) {
      return;
    }

    if (hasInProgressSheet && nextRoundId !== roundId) {
      setRoundSelectionMessage("Finissez votre saisie en cours, puis changez de tournée de saisie.");
      return;
    }

    setRoundSelectionMessage(null);
    setRoundId(nextRoundId);
  }

  function getRoundOptionLabel(round: RoundOption) {
    if (round.status === "active") return `${round.label} (ouverte ${round.opensAtLabel} → ${round.closesAtLabel})`;
    if (round.status === "closed") return `${round.label} (fermée)`;
    return `${round.label} (ouvrira à ${round.opensAtLabel})`;
  }

  return (
    <form action={formAction} className="space-y-4 rounded border bg-white p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Tournée</span>
          <select
            name="roundId"
            disabled={disabled}
            value={roundId}
            onChange={(event) => handleRoundChange(event.target.value)}
            required
            className="w-full rounded border p-2"
          >
            <option value="">Sélectionner une tournée</option>
            {rounds.map((round) => (
              <option key={round.id} value={round.id} disabled={!round.isSelectable}>
                {getRoundOptionLabel(round)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Ligne</span>
          <select
            name="laneId"
            disabled={disabled}
            value={laneId}
            onChange={(event) => {
              setLaneId(event.target.value);
              setRoundSelectionMessage(null);
            }}
            required
            className="w-full rounded border p-2"
          >
            <option value="">Sélectionner une ligne</option>
            {lanes.map((lane) => (
              <option key={lane.id} value={lane.id}>
                {lane.code}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700">Distance ligne</p>
          <p className="rounded border bg-slate-50 p-2 text-slate-800">
            {selectedLane ? `${selectedLane.distanceM} m` : "Sélectionnez une ligne"}
          </p>
        </div>
      </div>

      {loadedMessage ? <p className="rounded border border-blue-200 bg-blue-50 p-2 text-sm text-blue-700">{loadedMessage}</p> : null}
      {activeRound ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800">
          Tournée ouverte actuellement : <strong>{activeRound.label}</strong> ({activeRound.opensAtLabel} → {activeRound.closesAtLabel}).
        </p>
      ) : (
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
          Aucune tournée n’est ouverte à la saisie pour l’instant.
        </p>
      )}
      {roundSelectionMessage ? (
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700">{roundSelectionMessage}</p>
      ) : null}
      {!roundId || !laneId ? (
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
          Choisissez d&apos;abord la tournée et le type de ligne pour déverrouiller la saisie des distances.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded border">
        <table className={`min-w-full divide-y divide-slate-200 text-sm ${isEntryLocked ? "opacity-60" : ""}`}>
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left">N°</th>
              <th className="p-2 text-left">Carrés</th>
              <th className="p-2 text-left">Traits</th>
              <th className="p-2 text-left">Nom / Prénom</th>
              <th className="p-2 text-left">Club</th>
              <th className="p-2 text-left">Section</th>
              <th className="p-2 text-left">Total longueurs</th>
              <th className="p-2 text-left">Distance</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => {
              const swimmerNumber = Number.parseInt(row.swimmerNumber, 10);
              const squares = Number.parseInt(row.squares, 10);
              const ticks = Number.parseInt(row.ticks, 10);
              const swimmer = Number.isNaN(swimmerNumber) ? null : swimmerByNumber.get(swimmerNumber) ?? null;
              const totalLengths = (Number.isNaN(squares) ? 0 : squares) * 4 + (Number.isNaN(ticks) ? 0 : ticks);
              const distance = selectedLane ? totalLengths * selectedLane.distanceM : 0;

              return (
                <tr key={`row-${index}`}>
                  <td className="p-2">
                    <input
                      inputMode="numeric"
                      min={1}
                      value={row.swimmerNumber}
                      disabled={isEntryLocked}
                      onChange={(event) => updateRow(index, { swimmerNumber: event.target.value })}
                      className="w-20 rounded border p-1"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      inputMode="numeric"
                      min={0}
                      value={row.squares}
                      disabled={isEntryLocked}
                      onChange={(event) => updateRow(index, { squares: event.target.value })}
                      className="w-20 rounded border p-1"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      inputMode="numeric"
                      min={0}
                      value={row.ticks}
                      disabled={isEntryLocked}
                      onChange={(event) => updateRow(index, { ticks: event.target.value })}
                      className="w-20 rounded border p-1"
                    />
                  </td>
                  <td className="p-2 text-slate-700">
                    {swimmer ? `${swimmer.lastName} ${swimmer.firstName}` : row.swimmerNumber ? "Nageur introuvable" : "-"}
                  </td>
                  <td className="p-2 text-slate-700">{swimmer?.clubName ?? "-"}</td>
                  <td className="p-2 text-slate-700">{swimmer?.sectionName ?? "-"}</td>
                  <td className="p-2 text-slate-700">{totalLengths}</td>
                  <td className="p-2 text-slate-700">{distance} m</td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => setRows((previousRows) => previousRows.filter((_item, rowIndex) => rowIndex !== index))}
                      disabled={isEntryLocked || rows.length <= 1}
                      className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <input type="hidden" name="entriesJson" value={JSON.stringify(normalizedRows)} />

      <button
        type="button"
        onClick={() => setRows((previousRows) => [...previousRows, EMPTY_ROW])}
        disabled={isEntryLocked}
        className="rounded border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        Ajouter une ligne nageur
      </button>

      <div className="rounded border bg-slate-50 p-3 text-sm">
        <p>
          <span className="font-medium">Total feuille :</span> {sheetTotalDistance} m
        </p>
      </div>

      {state.error ? <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{state.success}</p>
      ) : null}

      <button
        type="submit"
        disabled={isEntryLocked}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        Enregistrer la feuille
      </button>
    </form>
  );
}
