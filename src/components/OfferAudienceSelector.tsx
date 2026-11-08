import React, { useId } from "react";
import type { Affiliate } from "../lib/affiliates";
import {
  audienceUsesAffiliates,
  type OfferAudience,
} from "../lib/offerAudience";

interface OfferAudienceSelectorProps {
  audience: OfferAudience;
  onAudienceChange: (audience: OfferAudience) => void;
  affiliates: Affiliate[];
  selectedAffiliateIds: string[];
  onSelectedAffiliateIdsChange: (ids: string[]) => void;
  fleetEnabled: boolean | null;
  affiliatesEnabled: boolean | null;
}

const options: {
  value: OfferAudience;
  label: string;
  detail: string;
}[] = [
  {
    value: "public",
    label: "Bourse publique",
    detail: "Visible par tous les transporteurs.",
  },
  {
    value: "own_fleet",
    label: "Ma flotte propre",
    detail: "Visible par vos chauffeurs rattachés.",
  },
  {
    value: "affiliates",
    label: "Affiliés sélectionnés",
    detail: "Visible uniquement par les transporteurs choisis.",
  },
  {
    value: "own_fleet_and_affiliates",
    label: "Ma flotte et des affiliés",
    detail: "Visible par vos chauffeurs et les transporteurs choisis.",
  },
];

export default function OfferAudienceSelector({
  audience,
  onAudienceChange,
  affiliates,
  selectedAffiliateIds,
  onSelectedAffiliateIdsChange,
  fleetEnabled,
  affiliatesEnabled,
}: OfferAudienceSelectorProps) {
  const radioGroupName = useId();
  const acceptedAffiliates = affiliates.filter((affiliate) => affiliate.statut === "accepte");
  const audienceNeedsAffiliates = audienceUsesAffiliates(audience);

  const toggleAffiliate = (carrierId: string, checked: boolean) => {
    onSelectedAffiliateIdsChange(
      checked
        ? [...new Set([...selectedAffiliateIds, carrierId])]
        : selectedAffiliateIds.filter((id) => id !== carrierId),
    );
  };

  return (
    <div className="border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
      <span className="text-[11px] font-black uppercase text-slate-800 block">
        Diffusion de l'offre
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((option) => {
          const needsFleet = option.value === "own_fleet" || option.value === "own_fleet_and_affiliates";
          const needsAffiliates = option.value === "affiliates" || option.value === "own_fleet_and_affiliates";
          const disabled =
            (needsFleet && fleetEnabled !== true) ||
            (needsAffiliates && affiliatesEnabled !== true);

          return (
            <label
              key={option.value}
              className={`flex gap-2 rounded-xl border p-3 ${
                audience === option.value
                  ? "border-[#1D9E75] bg-emerald-50"
                  : "border-slate-100 bg-white"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name={`offre-audience-${radioGroupName}`}
                value={option.value}
                checked={audience === option.value}
                disabled={disabled}
                onChange={() => onAudienceChange(option.value)}
                className="mt-0.5 accent-[#1D9E75]"
              />
              <span>
                <span className="font-bold text-slate-800 block">{option.label}</span>
                <span className="text-[10px] text-slate-500">{option.detail}</span>
              </span>
            </label>
          );
        })}
      </div>

      {fleetEnabled === false && (
        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-2">
          L'option « flotte propre » n'est pas incluse dans votre forfait.
        </p>
      )}
      {affiliatesEnabled === false && (
        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-2">
          L'option « transporteurs affiliés » n'est pas incluse dans votre forfait.
        </p>
      )}
      {(fleetEnabled === null || affiliatesEnabled === null) && (
        <p className="text-[10px] text-slate-500">Chargement des options de diffusion…</p>
      )}

      {audienceNeedsAffiliates && (
        <div className="space-y-2">
          <p className="font-bold text-slate-700">
            Choisissez au moins un transporteur affilié accepté :
          </p>
          {acceptedAffiliates.length === 0 ? (
            <p className="text-slate-500">
              Aucun affilié accepté. Un transporteur doit accepter votre invitation avant de recevoir une offre.
            </p>
          ) : (
            <>
              <button
                type="button"
                className="text-[#1D9E75] font-bold cursor-pointer"
                onClick={() =>
                  onSelectedAffiliateIdsChange(
                    selectedAffiliateIds.length === acceptedAffiliates.length
                      ? []
                      : acceptedAffiliates.map((affiliate) => affiliate.carrier_id),
                  )
                }
              >
                {selectedAffiliateIds.length === acceptedAffiliates.length
                  ? "Tout désélectionner"
                  : "Tous mes affiliés acceptés"}
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {acceptedAffiliates.map((affiliate) => (
                  <label
                    key={affiliate.carrier_id}
                    className="flex items-center gap-2 cursor-pointer rounded-lg p-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAffiliateIds.includes(affiliate.carrier_id)}
                      onChange={(event) => toggleAffiliate(affiliate.carrier_id, event.target.checked)}
                      className="accent-[#1D9E75]"
                    />
                    <span>
                      {affiliate.nom}
                      {affiliate.wilaya ? ` · ${affiliate.wilaya}` : ""}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
