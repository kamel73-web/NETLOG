import React, { useState } from "react";
import { RESERVE_MAX, ReservePhase, addMissionReserve, sanitizeReserveInput } from "../lib/ldv";

/**
 * Saisie d'une réserve (chauffeur OU donneur d'ordre : le serveur déduit le rôle).
 * Remplace TOUS les anciens champs de réserves (dashboards, modale de validation,
 * lien SMS /r/:id/reserve-*). Texte vide + « Enregistrer » = effacer sa réserve.
 */
export default function ReserveField({
  missionId,
  phase,
  initial = "",
  onSaved,
}: {
  missionId: number;
  phase: ReservePhase;
  initial?: string;
  onSaved?: (texte: string) => void;
}) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  const save = async () => {
    setState("saving");
    try {
      await addMissionReserve(missionId, phase, text);
      setState("ok");
      setMsg("");
      onSaved?.(text.trim());
    } catch (e) {
      setState("err");
      setMsg(e instanceof Error ? e.message : "Erreur");
    }
  };

  const left = RESERVE_MAX - text.length;
  return (
    <div className="space-y-1">
      <textarea
        dir="auto"
        rows={3}
        value={text}
        maxLength={RESERVE_MAX}
        onChange={(e) => {
          setText(sanitizeReserveInput(e.target.value));
          setState("idle");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault(); // pas de retour à la ligne
        }}
        placeholder="Ex : 3 sacs déchirés, humidité sur la palette 12"
        className="w-full rounded-lg border border-slate-300 p-2 text-sm"
      />
      <div className="flex items-center justify-between text-xs">
        <span className={left < 20 ? "font-bold text-rose-600" : "text-slate-500"}>{left} caractères restants</span>
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="rounded-lg bg-slate-900 px-3 py-1.5 font-bold text-white disabled:opacity-50"
        >
          {state === "saving" ? "…" : state === "ok" ? "✓ Enregistré" : "Enregistrer"}
        </button>
      </div>
      {state === "err" && <p className="text-xs text-rose-600">{msg}</p>}
    </div>
  );
}
