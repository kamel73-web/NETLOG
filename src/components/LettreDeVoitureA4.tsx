import React from "react";
import { LdvPayload, fmtDate, fmtTime, formatDzPhone, formatNumber, formatQuantity, placeLine } from "../lib/ldv";

/**
 * Lettre de voiture A4 (794 x 1123 px). Dimensions FIXES : aucune donnée ne peut
 * pousser la mise en page. Styles inline en hexadécimal uniquement : html2canvas
 * ne sait pas lire oklch()/color-mix() générés par Tailwind v4.
 * Aucune valeur par défaut inventée : champ absent = « — » ou ligne vierge.
 */
export const LDV_W = 794;
export const LDV_H = 1123;

const C = { violet: "#5b2a9e", band: "#efe9fb", text: "#1f1f2e", mute: "#6b6b80", line: "#d9d3ea" };
const FONT = "Arial, Helvetica, sans-serif";

const clip = (lines: number, lh = 14): React.CSSProperties => ({
  maxHeight: lines * lh,
  lineHeight: `${lh}px`,
  overflow: "hidden",
  wordBreak: "break-word",
});

function Band({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.band, color: C.violet, fontWeight: 700, fontSize: 15, padding: "7px 16px", textTransform: "uppercase", ...style }}>
      {children}
    </div>
  );
}

function Txt({ v, bold, size = 12, lines = 1 }: { v?: string | null; bold?: boolean; size?: number; lines?: number }) {
  return (
    <div dir="auto" style={{ fontSize: size, fontWeight: bold ? 700 : 400, color: v ? C.text : C.mute, ...clip(lines, size + 3) }}>
      {v || "—"}
    </div>
  );
}

function ReservesBox({
  items,
  done,
}: {
  items: LdvPayload["reserves"];
  done: boolean;
}) {
  const label = { chauffeur: "Conducteur", donneur_ordre: "Donneur d'ordre", historique: "Consigné" } as const;
  return (
    <div style={{ minHeight: 96, maxHeight: 96, overflow: "hidden", marginTop: 4 }}>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: C.mute, fontStyle: "italic" }}>{done ? "Néant" : ""}</div>
      ) : (
        items.map((r) => (
          <div key={r.role} dir="auto" style={{ fontSize: 10.5, color: C.text, marginBottom: 3, ...clip(3, 13) }}>
            <b>{label[r.role]} :</b> {r.texte}
          </div>
        ))
      )}
    </div>
  );
}

function SignBox({ label }: { label: string }) {
  return (
    <div style={{ width: 150, height: 86, border: `1px solid ${C.violet}`, padding: "6px 8px", fontSize: 12, color: C.text }}>
      {label}
    </div>
  );
}

export default function LettreDeVoitureA4({ data, qrDataUrl }: { data: LdvPayload; qrDataUrl?: string }) {
  const m = data.marchandises;
  const lignes = m.lignes.slice(0, 8);
  const chargDone = Boolean(data.chargement.at);
  const livrDone = Boolean(data.dechargement.confirmee_at);

  const poids =
    m.poids_declare_kg != null
      ? `${formatNumber(m.poids_declare_kg)} kg`
      : m.poids_estime_kg != null
        ? `≈ ${formatNumber(m.poids_estime_kg)} kg (estimé)`
        : "Non renseigné";

  const resChar = data.reserves.filter((r) => r.phase === "chargement");
  const resDech = data.reserves.filter((r) => r.phase === "dechargement");

  const dateLine = (iso: string | null) =>
    iso ? `${fmtDate(iso)}  à  ${fmtTime(iso)}` : "____ / ____ / ________   à   ____ : ____";

  const destNom = data.dechargement.destinataire_nom;

  return (
    <div
      style={{
        width: LDV_W,
        height: LDV_H,
        boxSizing: "border-box",
        background: "#ffffff",
        fontFamily: FONT,
        color: C.text,
        padding: 18,
      }}
    >
      <div style={{ height: "100%", border: `2px solid ${C.violet}`, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        {/* En-tête */}
        <div style={{ height: 128, padding: "14px 24px 0", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ width: 600 }}>
            <div dir="auto" style={{ fontSize: 20, fontWeight: 800, textTransform: "uppercase", ...clip(1, 24) }}>
              {data.transporteur.raison_sociale || "Transporteur"}
            </div>
            <div style={{ fontSize: 26, color: "#444", marginTop: 14, whiteSpace: "nowrap" }}>Lettre de voiture N° {data.numero}</div>
            <div style={{ fontSize: 14, color: "#444", marginTop: 4 }}>DATE : {fmtDate(data.date_emission)}</div>
          </div>
          <div style={{ width: 96, textAlign: "center" }}>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR" width={92} height={92} style={{ display: "block" }} />
            ) : (
              <div style={{ width: 92, height: 92, border: `1px solid ${C.line}` }} />
            )}
            <div style={{ fontSize: 8.5, fontWeight: 700, marginTop: 2 }}>ID EXPÉDITION : {data.offer_id}</div>
          </div>
        </div>

        {/* Parties */}
        <div style={{ display: "flex", flexShrink: 0, height: 178 }}>
          <div style={{ flex: 1, borderRight: `2px solid ${C.violet}` }}>
            <Band>Transporteur</Band>
            <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              <Txt v={data.transporteur.raison_sociale} bold size={13} />
              <Txt v={data.transporteur.adresse} lines={2} size={11} />
              <Txt v={data.transporteur.tel ? `Tél : ${formatDzPhone(data.transporteur.tel)}` : null} size={11} />
              <Txt v={data.transporteur.email ? `Email : ${data.transporteur.email}` : null} size={11} />
            </div>
          </div>
          <div style={{ flex: 1, borderRight: `2px solid ${C.violet}` }}>
            <Band>Conducteur</Band>
            <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              <Txt v={data.conducteur.nom} bold size={13} />
              <Txt v={data.conducteur.type_vehicule ? `Véhicule : ${data.conducteur.type_vehicule}` : null} size={11} lines={2} />
              <Txt v={data.conducteur.immatriculation ? `Immatriculation : ${data.conducteur.immatriculation}` : null} size={11} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <Band>Donneur d'ordre</Band>
            <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              <Txt v={data.donneur_ordre.raison_sociale} bold size={13} lines={2} />
              <Txt v={data.donneur_ordre.adresse} lines={3} size={11} />
            </div>
          </div>
        </div>

        {/* Marchandises */}
        <Band style={{ flexShrink: 0 }}>Marchandises</Band>
        <div style={{ padding: "8px 24px 0", height: 262, flexShrink: 0, boxSizing: "border-box" }}>
          <div style={{ display: "flex", fontSize: 10.5, color: C.mute, textTransform: "uppercase", padding: "4px 12px", borderBottom: `1px solid ${C.line}` }}>
            <div style={{ width: 430 }}>Nature</div>
            <div>Quantité</div>
          </div>
          {lignes.length > 0 ? (
            lignes.map((l, i) => (
              <div key={i} style={{ display: "flex", fontSize: 12.5, padding: "0 12px", height: 24, lineHeight: "24px", borderBottom: `1px solid ${C.line}` }}>
                <div dir="auto" style={{ width: 430, overflow: "hidden", whiteSpace: "nowrap" }}>{l.designation}</div>
                <div>{formatQuantity(Number(l.quantite), l.unite)}</div>
              </div>
            ))
          ) : (
            <div style={{ display: "flex", fontSize: 12.5, padding: "0 12px", height: 24, lineHeight: "24px", borderBottom: `1px solid ${C.line}` }}>
              <div dir="auto" style={{ width: 430, overflow: "hidden", whiteSpace: "nowrap" }}>{m.nature || "Marchandise non précisée"}</div>
              <div style={{ color: C.mute }}>Non détaillée</div>
            </div>
          )}
          <div style={{ display: "flex", fontSize: 12.5, fontWeight: 700, padding: "0 12px", height: 28, lineHeight: "28px" }}>
            <div style={{ width: 430 }}>Poids</div>
            <div>{poids}</div>
          </div>
        </div>

        {/* Document de suivi */}
        <Band style={{ flexShrink: 0 }}>Document de suivi</Band>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Chargement */}
          <div style={{ width: "50%", borderRight: `2px solid ${C.violet}`, padding: "12px 22px 0", boxSizing: "border-box" }}>
            <div style={{ fontSize: 15, textDecoration: "underline", marginBottom: 8 }}>CHARGEMENT</div>
            <Txt v={data.donneur_ordre.raison_sociale} bold size={12} />
            <div style={{ height: 6 }} />
            <Txt v={placeLine(data.chargement)} size={11} lines={2} />
            <div style={{ fontSize: 12, margin: "10px 0 8px" }}>
              Date et heure du chargement : <b>{dateLine(data.chargement.at)}</b>
            </div>
            <div style={{ fontSize: 14, textDecoration: "underline" }}>Réserves :</div>
            <ReservesBox items={resChar} done={chargDone} />
            <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
              <SignBox label="Conducteur :" />
              <SignBox label="Expéditeur :" />
            </div>
          </div>

          {/* Déchargement */}
          <div style={{ width: "50%", padding: "12px 22px 0", boxSizing: "border-box" }}>
            <div style={{ fontSize: 15, textDecoration: "underline", marginBottom: 8 }}>DÉCHARGEMENT</div>
            <Txt v={destNom || "Destinataire à identifier à la livraison"} bold size={12} />
            <div style={{ height: 6 }} />
            <Txt v={placeLine(data.dechargement)} size={11} lines={2} />
            <Txt v={data.dechargement.destinataire_tel ? `Tél : ${formatDzPhone(data.dechargement.destinataire_tel)}` : null} size={11} />
            <div style={{ fontSize: 12, margin: "6px 0 8px" }}>
              Date et heure du déchargement : <b>{dateLine(data.dechargement.at)}</b>
            </div>
            <div style={{ fontSize: 14, textDecoration: "underline" }}>Réserves :</div>
            <ReservesBox items={resDech} done={livrDone} />
            <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
              <SignBox label="Conducteur :" />
              <SignBox label="Destinataire :" />
            </div>
          </div>
        </div>

        {/* Pied */}
        <div style={{ borderTop: `1px solid ${C.line}`, padding: "6px 18px", fontSize: 8.5, color: C.mute, lineHeight: "11px", flexShrink: 0 }}>
          Document établi via la plateforme NETLOG, qui agit uniquement comme intermédiaire de mise en relation et n'est pas partie au
          contrat de transport.{" "}
          {data.frozen
            ? `Document figé après confirmation de livraison${data.dechargement.confirmee_at ? ` le ${fmtDate(data.dechargement.confirmee_at)} à ${fmtTime(data.dechargement.confirmee_at)}` : ""}.`
            : "Version provisoire : le contenu sera figé à la confirmation de livraison."}
        </div>
      </div>
    </div>
  );
}
