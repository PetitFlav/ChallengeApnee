"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";

type CreateSwimmerState = {
  error: string | null;
  success: boolean;
  nextNumber: number;
};

type Props = {
  clubs: Array<{ id: string; name: string }>;
  sections: Array<{ id: string; name: string }>;
  defaultNumber: number;
  action: (state: CreateSwimmerState, formData: FormData) => Promise<CreateSwimmerState>;
};

export function SwimmerCreateForm({ clubs, sections, defaultNumber, action }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(action, {
    error: null,
    success: false,
    nextNumber: defaultNumber,
  });

  useEffect(() => {
    if (!state.success) return;

    formRef.current?.reset();

    const numberPreview = formRef.current?.elements.namedItem("numberPreview") as HTMLInputElement | null;
    if (numberPreview) {
      numberPreview.value = String(state.nextNumber);
    }
  }, [state.nextNumber, state.success]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 md:grid-cols-6">
      <input
        name="numberPreview"
        type="number"
        defaultValue={defaultNumber}
        readOnly
        aria-label="Prochain numéro"
        className="rounded border bg-slate-100 p-2 text-slate-700"
      />
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

      {state.error ? (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 md:col-span-6">{state.error}</p>
      ) : null}

      <button type="submit" className="rounded bg-blue-600 p-2 text-white md:col-span-6">
        Ajouter
      </button>
    </form>
  );
}
