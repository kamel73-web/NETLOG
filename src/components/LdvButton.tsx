import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import LettreDeVoitureA4, { LDV_H, LDV_W } from "./LettreDeVoitureA4";
import { LdvPayload, fetchLdv } from "../lib/ldv";
import { exportElementToPdf } from "../lib/ldvPdf";
import { getMissionIdByOfferId } from "../lib/missions";

/**
 * <LdvButton offerId={…} />  ou  <LdvButton missionId={…} />
 * Les données viennent de la base (RPC get_ldv_payload), PAS de l'état React :
 * le bouton fonctionne donc dans « Missions terminées », l'historique, après
 * rechargement de la page, pour le donneur d'ordre, le transporteur et le chauffeur.
 */
interface Props {
  offerId?: number | string;
  missionId?: number;
  label?: string;
  className?: string;
}

export default function LdvButton({ offerId, missionId, label = "📄 Lettre de voiture", className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {open && <LdvViewer offerId={offerId} missionId={missionId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function LdvViewer({ offerId, missionId, onClose }: Props & { onClose: () => void }) {
  const [data, setData] = useState<LdvPayload | null>(null);
  const [qr, setQr] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scale, setScale] = useState(() => Math.min(1, (window.innerWidth - 24) / LDV_W));
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => setScale(Math.min(1, (window.innerWidth - 24) / LDV_W));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = missionId ?? (await getMissionIdByOfferId(Number(offerId)));
        const payload = await fetchLdv(id);
        // QR généré localement : fonctionne hors ligne, aucune fuite vers un service tiers
        const url = `${window.location.origin}${window.location.pathname}?track=${payload.offer_id}`;
        const dataUrl = await QRCode.toDataURL(url, { margin: 0, width: 240, errorCorrectionLevel: "M" });
        if (!cancelled) {
          setData(payload);
          setQr(dataUrl);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur inconnue");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offerId, missionId]);

  const download = async () => {
    if (!data || !captureRef.current) return;
    setBusy(true);
    try {
      await exportElementToPdf(captureRef.current, `${data.numero}.pdf`);
    } catch (e) {
      setError("Échec de la génération du PDF : " + (e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,.8)", overflowY: "auto" }}>
      <div style={{ position: "sticky", top: 0, display: "flex", gap: 8, justifyContent: "flex-end", padding: 10, background: "#0f172a" }}>
        <button
          type="button"
          onClick={download}
          disabled={!data || !qr || busy}
          style={{ padding: "8px 14px", borderRadius: 10, background: "#1D9E75", color: "#fff", fontWeight: 700, opacity: !data || !qr || busy ? 0.5 : 1 }}
        >
          {busy ? "Génération…" : "⬇️ Télécharger PDF"}
        </button>
        <button type="button" onClick={onClose} style={{ padding: "8px 14px", borderRadius: 10, background: "#D85A30", color: "#fff", fontWeight: 700 }}>
          ✕ Fermer
        </button>
      </div>

      {error && <p style={{ color: "#fecaca", padding: 16 }}>{error}</p>}
      {!data && !error && <p style={{ color: "#fff", padding: 16 }}>Chargement de la lettre de voiture…</p>}

      {data && (
        <div style={{ margin: "12px auto", width: LDV_W * scale, height: LDV_H * scale }}>
          <div style={{ width: LDV_W, height: LDV_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <LettreDeVoitureA4 data={data} qrDataUrl={qr} />
          </div>
        </div>
      )}

      {/* Copie hors écran, SANS transform : c'est elle qui est capturée pour le PDF */}
      {data && (
        <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: LDV_W, height: LDV_H, pointerEvents: "none" }}>
          <div ref={captureRef} style={{ width: LDV_W, height: LDV_H }}>
            <LettreDeVoitureA4 data={data} qrDataUrl={qr} />
          </div>
        </div>
      )}
    </div>
  );
}
