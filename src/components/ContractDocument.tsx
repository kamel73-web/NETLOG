/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { OffreFret, PropositionPrix, Facture, UserProfile, MoyenTransport, OffreStatus } from "../types";
import { FileText, Printer, CheckCircle, Shield, Truck, Landmark, Mail, Check, CreditCard, RefreshCw } from "lucide-react";

interface ContractDocumentProps {
  type: "DO-BDF" | "BDF-TRANS" | "LOGISTIQUE" | "LETTRE-VOITURE" | "FACTURE";
  offre: OffreFret;
  proposition?: PropositionPrix;
  facture?: Facture;
  donneur: UserProfile;
  prestataire?: UserProfile;
  moyen?: MoyenTransport;
  lang?: "fr" | "ar";
  onPrint?: () => void;
  onClose: () => void;
  // Dynamic props for monthly grouped operations and subscriptions
  groupedMissions?: OffreFret[];
  isAbonnement?: boolean;
  subscriptionDetails?: {
    carrierType: "artisan" | "entreprise";
    duration: "mensuel" | "trimestriel" | "semestriel" | "annuel" | "2ans";
    trucksCount?: number;
    amountHT: number;
    tva: number;
    amountTTC: number;
  };
  onSimulateScan?: (offreId: string) => void;
}

export default function ContractDocument({
  type,
  offre,
  proposition,
  facture,
  donneur,
  prestataire,
  moyen,
  lang = "fr",
  onPrint,
  onClose,
  groupedMissions = [],
  isAbonnement = false,
  subscriptionDetails,
  onSimulateScan,
}: ContractDocumentProps) {
  const isAr = lang === "ar";
  const todayDateStr = new Date().toISOString().split('T')[0];
  const dateDocument = new Date().toLocaleDateString(isAr ? "ar-DZ" : "fr-FR");

  // State for interactive simulation in the invoice preview
  const [isConventionne, setIsConventionne] = useState<boolean>(() => {
    // If we have an existing record, default to it, otherwise simulate
    if (facture && typeof (facture as any).isConventionne === "boolean") {
      return (facture as any).isConventionne;
    }
    return true; // Default simulation
  });

  const [reglementMode, setReglementMode] = useState<string>(() => {
    return facture?.modeReglement || "Virement";
  });

  const [delaiPaiement, setDelaiPaiement] = useState<string>("30 jours");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Generate dynamic unique codes
  const codeUnique = type === "LETTRE-VOITURE" 
    ? `LDV-${new Date().getFullYear()}-${offre?.id?.slice(-4).toUpperCase() || "0042"}`
    : isAbonnement 
      ? `ABO-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`
      : facture?.id || `FAC-${new Date().getFullYear()}-${offre?.id?.slice(-4).toUpperCase() || "1028"}`;

  const printDocument = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleSendEmailSimulated = () => {
    setEmailSending(true);
    setTimeout(() => {
      setEmailSending(false);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3500);
    }, 1500);
  };

  // Compute values for unique/grouped logistics invoice
  const isBilanMensuel = groupedMissions.length > 0 || (facture as any)?.isMensuelleGroupee;
  const activeMissionsList = groupedMissions.length > 0 ? groupedMissions : (offre ? [offre] : []);

  // Compute HT amount
  let totalHT = 0;
  if (isAbonnement && subscriptionDetails) {
    totalHT = subscriptionDetails.amountHT;
  } else if (isBilanMensuel) {
    totalHT = activeMissionsList.reduce((sum, o) => {
      // Find proportional amount or convenu price
      return sum + (o.prixFixe || (o as any).prixConvenu || 80000);
    }, 0);
  } else {
    totalHT = facture?.montant || proposition?.prixPropose || offre?.prixFixe || 80000;
  }

  const computedTVA = Math.round(totalHT * 0.19); // 19% TVA specified
  const totalTTC = totalHT + computedTVA;

  // Determine Émetteur details dynamically
  const emetteurNom = isAbonnement
    ? "NETLOG SOLUTIONS LOGISTIQUES DZ"
    : isConventionne
      ? "NETLOG SOLUTIONS LOGISTIQUES DZ (Émetteur pour DO Conventionné)"
      : prestataire?.raisonSociale || "Équipe de Transporteurs Partenaires NETLOG";

  const emetteurRC = isAbonnement || isConventionne
    ? "16/00-1102934B22 (Sarl NETLOG)"
    : prestataire?.nrc || "0974301-A-16";

  const emetteurNIF = isAbonnement || isConventionne
    ? "001616099120349"
    : prestataire?.nif || "1984530012019";

  const emetteurAdresse = isAbonnement || isConventionne
    ? "Boulevard Khalifa Boukhalfa, Alger Centre, Algérie"
    : prestataire?.adresse || "Zone Industrielle Oued Smar, Alger";

  const emetteurTel = isAbonnement || isConventionne
    ? "+213 (0) 23 45 67 89 / info@netlog.dz"
    : prestataire?.tel || "+213 (0) 550 12 34 56";

  // Mock static values for Lettre de Voiture details
  const ldvVolume = (offre?.poids ? Math.round(offre.poids * 2.2) : 45) + " m³";
  const ldvNbColis = "33 Palettes plastifiées (Filme étirable)";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col my-4 border border-slate-100 max-h-[95vh]">
        
        {/* INTERACTIVE CONTROLS BAR (Non-printable) */}
        <div style={{ backgroundColor: '#0f172a', color: '#ffffff' }} className="p-4 flex flex-wrap justify-between items-center gap-3 shrink-0 no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#1D9E75]" />
            <span className="font-extrabold font-mono tracking-wide text-xs uppercase">
              {type === "FACTURE" && isAbonnement ? "👁️ FACTURE D'ABONNEMENT ADMIN" : `👁️ ${type} EN DIRECT`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* If it is a generic transport invoice, allow interactive toggling of the "DO Conventionné" clause */}
            {type === "FACTURE" && !isAbonnement && (
              <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700 text-[11px] mr-2">
                <span className="px-2 font-bold text-slate-400">DO Conventionné ?</span>
                <button
                  onClick={() => setIsConventionne(true)}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition ${isConventionne ? "bg-[#1D9E75] text-white" : "text-slate-400 hover:text-white"}`}
                >
                  Oui (Netlog)
                </button>
                <button
                  onClick={() => setIsConventionne(false)}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition ${!isConventionne ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  Non (Camionneur)
                </button>
              </div>
            )}

            <button
              onClick={printDocument}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1D9E75] hover:bg-[#085041] text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4" />
              {isAr ? "طباعة الفاتورة" : "🖨️ Imprimer / PDF"}
            </button>

            {type === "FACTURE" && (
              <button
                onClick={handleSendEmailSimulated}
                disabled={emailSending}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  emailSent 
                    ? "bg-[#1D9E75]/90 text-white" 
                    : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                }`}
              >
                {emailSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Envoi...
                  </>
                ) : emailSent ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Facture envoyée !
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    📧 Envoyer par email
                  </>
                )}
              </button>
            )}

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#D85A30] hover:bg-rose-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-sm active:scale-95 border-none"
              title={isAr ? "إغلاق" : "Fermer"}
            >
              <span className="text-sm font-black">✕</span>
              <span>{isAr ? "إغلاق" : "Fermer [✕]"}</span>
            </button>
          </div>
        </div>

        {/* PAPER BOUNDS CONTENT */}
        <div 
          id="printable-area" 
          dir={isAr ? "rtl" : "ltr"} 
          className="p-10 overflow-y-auto bg-white text-slate-800 font-sans leading-relaxed flex-1"
        >
          {/* Paper Header / Letterhead */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black tracking-tighter text-slate-950 font-sans">
                  NET<span className="text-[#1D9E75]">LOG</span>
                </span>
                <span className="text-[10px] bg-emerald-50 text-[#1D9E75] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  ALGERIA
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                La Bourse de Fret Routier et de Facturation Logistique Digitale
              </p>
              <p className="text-[9px] text-slate-400 font-mono">
                Centre National d'Affrètement Numérique • Alger, Oran, Sétif, Hassi Messaoud
              </p>
            </div>
            
            <div className="text-right font-sans">
              <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest block">
                {type === "LETTRE-VOITURE" ? "Titre Officiel de Transport" : "Facturation Certifiée"}
              </span>
              <p className="text-sm font-mono mt-1 font-black text-slate-950 bg-slate-100 px-3 py-1 rounded-lg inline-block">
                {codeUnique}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Date d'édition : <b>{dateDocument}</b>
              </p>
            </div>
          </div>

          {/* DOCUMENT TITLE TITLE */}
          <div className="text-center mb-6 py-2 border-y border-dashed border-slate-200">
            <h1 className="text-base font-black uppercase tracking-wider text-slate-900">
              {type === "LETTRE-VOITURE" && "LETTRE DE VOITURE NATIONALE DE TRANSPORT ROUTIER"}
              {type === "FACTURE" && (isAbonnement ? "FACTURE ADMINISTRATIVE D'ABONNEMENT NETLOG" : (isBilanMensuel ? "FACTURE COMMERCIALE MENSUELLE CONSOLIDÉE" : "FACTURE PRESTATION UNIQUE DE TRANSPORT"))}
              {type !== "LETTRE-VOITURE" && type !== "FACTURE" && `${type} - ACCORD FORMEL NETLOG`}
            </h1>
            <p className="text-[10px] text-slate-500 italic mt-0.5">
              Établi par le système d'orchestration de fret automatisé NETLOG DZ, conformément à la réglementation routière en vigueur.
            </p>
          </div>

          {/* CLIENT / PARTNERS ROLES PANEL */}
          <div className="grid grid-cols-2 gap-6 mb-6 text-xs leading-normal">
            
            {/* Box 1: ÉMETTEUR DE LA FACTURE / NETLOG PLATFORM / OR QR CODE FOR LETTRE DE VOITURE */}
            <div className={`p-4 rounded-2xl border ${type === "LETTRE-VOITURE" ? "bg-white border-[#1D9E75]/30 flex flex-col items-center justify-between shadow-xs hover:border-[#1D9E75] hover:bg-emerald-50/10 transition cursor-pointer group select-none" : "bg-slate-50 border-slate-100"}`}>
              {type === "LETTRE-VOITURE" ? (
                <div 
                  onClick={() => onSimulateScan && onSimulateScan(offre.id)}
                  className="w-full h-full flex flex-col items-center justify-center space-y-2.5 text-center leading-normal"
                >
                  <span className="font-extrabold text-[#1D9E75] uppercase text-[9px] tracking-widest block font-sans">
                    📲 QR CODE : SUIVI EN DIRECT
                  </span>
                  
                  {/* Scannable Real QR code element */}
                  <div className="p-2 border border-slate-200 rounded-2xl bg-white shadow-xs group-hover:scale-[1.03] transition duration-200 flex items-center justify-center relative">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        typeof window !== 'undefined' 
                          ? `${window.location.origin}${window.location.pathname}?track=${offre.id}` 
                          : `https://netlog-bourse-de-fret.dz/?track=${offre.id}`
                      )}`} 
                      alt="QR Code d'expédition"
                      className="w-24 h-24 mix-blend-multiply" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-transparent group-hover:bg-[#1D9E75]/5 rounded-2xl flex items-center justify-center transition" />
                  </div>
                  
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black text-slate-800 block">
                      ID EXPÉDITION : {offre.id}
                    </span>
                    <span className="text-[9px] font-semibold text-slate-500 block max-w-[210px] mx-auto group-hover:text-[#1D9E75] leading-tight">
                      Scannez ce QR Code pour valider chargement / déchargement ou <b className="underline">cliquez ici</b> pour simuler.
                    </span>
                    <span className="text-[8px] font-mono text-slate-400 block break-all pt-1 max-w-[220px] mx-auto leading-normal">
                      🔗 {typeof window !== 'undefined' 
                        ? `${window.location.origin}${window.location.pathname}?track=${offre.id}` 
                        : `https://netlog-bourse-de-fret.dz/?track=${offre.id}`}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <span className="font-black text-[#1D9E75] uppercase text-[9px] tracking-widest block mb-2">
                    ÉMETTEUR DE LA FACTURE
                  </span>
                  <p className="font-extrabold text-slate-950 text-xs text-wrap">{emetteurNom}</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    <b>N° RC / Registre :</b> {emetteurRC}<br />
                    <b>Identifiant Fiscal (NIF) :</b> {emetteurNIF}<br />
                    <b>Adresse :</b> {emetteurAdresse}<br />
                    <b>Téléphone / Mail :</b> {emetteurTel}
                  </p>
                </>
              )}
            </div>

            {/* Box 2: DESTINATAIRE / CLIENT / DO */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="font-black text-[#1D9E75] uppercase text-[9px] tracking-widest block mb-1">
                {type === "LETTRE-VOITURE" ? "DONNEUR D'ORDRE (EXPÉDITEUR CONTRACTANT)" : "DESTINATAIRE / CLIENT DE FACTURATION"}
              </span>
              <p className="font-bold text-slate-950 text-xs">{donneur?.raisonSociale || "SARL BATIMEX"}</p>
              <p className="text-[11px] text-slate-600 mt-1">
                <b>Responsable :</b> {donneur?.nom || "Kamel"} {donneur?.prenom || "Babassi"}<br />
                <b>RC N° :</b> {donneur?.nrc || "0974100-B-16"}<br />
                <b>Wilaya d'origine :</b> {donneur?.wilaya || "Alger"}<br />
                <b>Adresse :</b> {donneur?.adresse || "12 Rue des Frères Bouadou, Bir Mourad Raïs, Alger"}<br />
                <b>Tél :</b> {donneur?.tel || "021 54 88 90"} • <b>Email :</b> {donneur?.email || "Kam.babassi@gmail.com"}
              </p>
            </div>
          </div>

          {/* CORE SECTION SPECIFIC TO TYPE */}
          {type === "LETTRE-VOITURE" ? (
            <div className="space-y-4">
              
              {/* TRUCK AND ROUTE CARRIER DETAILS */}
              <div className="p-4 rounded-2xl bg-[#E1F5EE]/40 border border-[#E1F5EE] grid grid-cols-2 gap-4 text-xs font-sans">
                <div>
                  <span className="font-black text-[9px] text-[#085041] uppercase block mb-1">Détails du Trajet (Axe de Transport)</span>
                  <p className="text-xs">
                    <b>DÉPART (Enlèvement) :</b> <span className="font-bold text-slate-900">{offre?.depart || "Alger"}</span> <br />
                    <span className="text-slate-500 font-mono text-[10px]">{offre?.departDetails || "Port National d'Alger, Quai 11"}</span>
                  </p>
                  <p className="text-xs mt-1.5">
                    <b>DESTINATION (Livraison) :</b> <span className="font-bold text-slate-900">{offre?.arrivee || "Oran"}</span> <br />
                    <span className="text-slate-500 font-mono text-[10px]">{offre?.arriveeDetails || "Entrepôt Centre Logistique Cité El Hamri"}</span>
                  </p>
                </div>

                <div>
                  <span className="font-black text-[9px] text-[#085041] uppercase block mb-1">Transporteur & Véhicule désigné</span>
                  <p className="text-xs">
                    <b>PRESTATAIRE :</b> <span className="font-bold text-slate-900">{prestataire?.raisonSociale || "EURL Ahmed Benzekri Transports"}</span><br />
                    <b>Wilaya d'Activité :</b> {prestataire?.wilaya || "Sidi Bel Abbès"}<br />
                    <b>Type de Camion :</b> {moyen ? `${moyen.marque} ${moyen.type}` : "Camion Porteur Tautliner 30 tonnes"}<br />
                    <b>Plaque constructeur :</b> <span className="font-mono bg-slate-100 font-black px-1.5 py-0.5 rounded text-slate-950">{moyen?.immatriculation || "012356-116-31"}</span>
                  </p>
                </div>
              </div>

              {/* MARCHANDISES TABLE */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-mono text-[9px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Désignation Marchandise</th>
                      <th className="p-3 text-center">Poids Convenu</th>
                      <th className="p-3 text-center">Volume Estimé</th>
                      <th className="p-3">Type & Nombre de Colis</th>
                      <th className="p-3 text-right">Montant de la Course</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-150 font-medium">
                      <td className="p-3 font-extrabold text-slate-900">
                        📦 {offre?.marchandise || "Acheminement de ciment en sacs"}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-[#1D9E75]">
                        {offre?.poids || 24} Tonnes
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {ldvVolume}
                      </td>
                      <td className="p-3 text-slate-600">
                        {ldvNbColis}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-slate-950">
                        {totalHT.toLocaleString()} DA
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* RÉSERVES CONTRADICTOIRES ENREGISTRÉES EN LIGNE (SMS/E-MAIL) */}
              {(offre?.reservesChargement || offre?.reservesLivraison || offre?.reserves) && (
                <div className="bg-rose-50/70 rounded-2xl border border-rose-200 p-4 text-xs font-sans text-rose-950 space-y-2">
                  <span className="font-extrabold text-[10px] text-rose-900 uppercase tracking-wider block flex items-center gap-1.5">
                    ⚠️ MENTIONS &amp; RÉSERVES DU DONNEUR D'ORDRE CONSIGNÉES SUR LA LETTRE DE VOITURE
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-2.5 bg-white rounded-xl border border-rose-100">
                      <span className="text-[9.5px] font-bold text-rose-800 block uppercase mb-1">📋 Phase 1 : Réserves au Chargement</span>
                      {offre?.reservesChargement ? (
                        <p className="text-[11px] italic font-semibold text-rose-950">"{offre.reservesChargement}"</p>
                      ) : (
                        <p className="text-[11px] italic text-slate-400">Aucune réserve signalée au chargement.</p>
                      )}
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-rose-100">
                      <span className="text-[9.5px] font-bold text-rose-800 block uppercase mb-1">🏁 Phase 2 : Réserves au Déchargement (Anomalies)</span>
                      {(offre?.reservesLivraison || offre?.reserves) ? (
                        <p className="text-[11px] italic font-semibold text-rose-950">"{offre.reservesLivraison || offre.reserves}"</p>
                      ) : (
                        <p className="text-[11px] italic text-slate-400">Aucune anomalie ou réserve formulée à la réception.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* REGULATION & STANDARD CLAUSES */}
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 text-xs font-sans text-amber-950 space-y-2">
                <span className="font-black text-[9.5px] text-amber-900 uppercase tracking-wide block">
                  CONDITIONS GÉNÉRALES DU DOCUMENT PARLEMENTAIRE DE VOYAGE (LDV DZ)
                </span>
                <p className="leading-relaxed text-[10.5px]">
                  Le transporteur atteste prendre en charge les marchandises susvisées en parfait état d’apparence, et s’engage à les livrer en l’état au destinataire final. Les délais de livraison de transport sont fixés contractuellement. En cas de retard, les pénalités d'arbitrage NETLOG s'appliquent. Le donneur d'ordre garantit l'exactitude des informations fournies (poids, nature de la marchandise).
                </p>
                <div className="pt-1.5 border-t border-amber-200/50 flex flex-wrap gap-x-6 text-[10px] text-amber-900 font-bold">
                  <span>Délai de Paiement : <b>30 Jours après déchargement</b></span>
                  <span>Franchise Assurances : <b>Prise en charge intégrale multirisque</b></span>
                  <span>Réserves complémentaires : <b>À notifier sous 48h</b></span>
                </div>
              </div>

              {/* TRIPLE SIGNATURE BLOCKS */}
              <div className="grid grid-cols-3 gap-4 pt-4 mt-6 border-t border-slate-200">
                <div className="p-3 border border-slate-150 rounded-2xl bg-slate-50 text-center font-sans space-y-4">
                  <span className="text-[9px] font-black uppercase text-slate-500 block">
                    1. LE DONNEUR D'ORDRE (DO)
                  </span>
                  <div className="h-14 border border-slate-200/60 rounded-xl bg-white flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black text-emerald-600">SIGNÉ ÉLECTRONIQUEMENT</span>
                    <span className="text-[8px] font-mono text-slate-400 mt-0.5">SHA256: {offre?.id?.slice(0, 8)}-CERT</span>
                  </div>
                  <p className="text-[8px] text-slate-400 italic font-mono uppercase">Vérifié sur IP Netlog</p>
                </div>

                <div className="p-3 border border-slate-150 rounded-2xl bg-slate-50 text-center font-sans space-y-4">
                  <span className="text-[9px] font-black uppercase text-slate-500 block">
                    2. LE TRANSPORTEUR AGRÉÉ
                  </span>
                  <div className="h-14 border border-slate-200/60 rounded-xl bg-white flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black text-emerald-600">SIGNÉ ÉLECTRONIQUEMENT</span>
                    <span className="text-[8px] font-mono text-slate-400 mt-0.5">Chauffeur ID ({prestataire?.raisonSociale?.substring(0,6).toUpperCase()})</span>
                  </div>
                  <p className="text-[8px] text-slate-400 italic font-mono uppercase">Plaque Validée Route</p>
                </div>

                <div className="p-3 border border-slate-150 rounded-2xl bg-[#1D9E75]/5 text-center font-sans space-y-4">
                  <span className="text-[9px] font-black uppercase text-[#0d4f3a] block">
                    3. LE DESTINATAIRE (CONSIGNEE)
                  </span>
                  <div className="min-h-14 py-1.5 border border-slate-350/60 rounded-xl bg-white border-dashed flex flex-col items-center justify-center text-slate-400 italic px-2">
                    {(offre?.status === OffreStatus.Valide || offre?.status === OffreStatus.Decharge) ? (
                      <div className="flex flex-col items-center">
                        {offre?.reserves ? (
                          <>
                            <span className="text-[9.5px] font-black text-amber-700 not-italic uppercase tracking-wide">⚠️ Acquitté avec réserves</span>
                            <span className="text-[8px] font-mono font-bold text-slate-700 not-italic max-w-[190px] truncate" title={offre.reserves}>
                              "{offre.reserves}"
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[9.5px] font-black text-emerald-600 not-italic uppercase tracking-wide">✅ Acquitté sans réserves</span>
                            <span className="text-[8px] font-mono text-slate-400 not-italic">Code validation OK : {offre?.codeConfirmation || "4281"}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-[8.5px] font-semibold text-slate-500">
                        [ Signature & Tampon à la réception ]
                      </div>
                    )}
                  </div>
                  <p className="text-[8px] text-slate-400 italic font-mono uppercase">Validé par OTP à quai</p>
                </div>
              </div>

            </div>
          ) : (
            
            // OTHERWISE WE ARE IN AN INVOICE VIEW (FACTURE OR FACTURE-ABONNEMENT)
            <div className="space-y-5 font-sans">
              
              {/* DESCRIPTION & METADATA SECTION */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-wrap justify-between items-center text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-black block tracking-wider">Type de règlement requis</span>
                  <strong className="text-slate-900 font-extrabold text-sm flex items-center gap-1">
                    💰 {reglementMode || "Virement bancaire / postaux CCP"}
                  </strong>
                </div>

                <div className="space-y-1 text-center md:text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-black block tracking-wider">Échéance de Paiement</span>
                  <strong className="text-rose-700 font-extrabold text-sm block">
                    {isAbonnement ? "Immédiat avant activation" : "Sous 30 jours (par défaut)"}
                  </strong>
                </div>
              </div>

              {/* RENDER DYNAMIC RADIOS SELECTION PANEL FOR THE USER OR EMBEDDED UNDER NON-PRINTABLE RULES */}
              <div className="p-3 rounded-2xl bg-indigo-50/20 border border-indigo-150/40 space-y-2 no-print">
                <span className="text-[9.5px] uppercase font-black text-indigo-900 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-700" /> Choisir Simulation Mode de règlement du client :
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {["Virement", "BaridiMob", "CIB", "Chèque", "Espèce"].map((mode) => (
                    <label 
                      key={mode} 
                      className={`px-3 py-1.5 rounded-xl border font-bold cursor-pointer transition flex items-center gap-1.5 ${
                        reglementMode === mode 
                          ? "bg-slate-900 text-white border-slate-900" 
                          : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="pay_mode"
                        checked={reglementMode === mode}
                        onChange={() => setReglementMode(mode)}
                        className="accent-teal-700 cursor-pointer"
                      />
                      <span>{mode}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* TABLE DES PRESTATIONS FACTURÉES */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1D9E75] text-white font-sans text-xs">
                    <tr>
                      <th className="p-3">Désignation de la prestation logistique</th>
                      <th className="p-3 text-right">Montant HT (DZD)</th>
                      <th className="p-3 text-center w-28">TVA %</th>
                      <th className="p-3 text-right w-40">Total Net TTC (DZD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isAbonnement && subscriptionDetails ? (
                      <tr className="border-b border-slate-150 font-medium bg-slate-50/40">
                        <td className="p-4">
                          <p className="font-extrabold text-slate-900">
                            🛡️ Adhésion Annuelle & Licence Opérateur Bourse NETLOG
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Type d'abonnement souscrit : <b>Transporteur {subscriptionDetails.carrierType === "entreprise" ? "Entreprise" : "Artisan"}</b> • Période : <b>{subscriptionDetails.duration}</b> <br />
                            Date d'effet : <b>{todayDateStr}</b> • Validation d'accès KYC certifié NetLog Algerie.
                          </p>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-700">
                          {totalHT.toLocaleString()} DA
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-slate-500">
                          19%
                        </td>
                        <td className="p-4 text-right font-mono font-black text-[#1D9E75]">
                          {totalTTC.toLocaleString()} DA
                        </td>
                      </tr>
                    ) : isBilanMensuel ? (
                      /* RENDER THE DETAILED MULTI-MISSIONS TABLE REQUESTED FOR THE GROUPED CASE */
                      <>
                        <tr className="bg-slate-100/50">
                          <td colSpan={4} className="p-2.5 font-bold text-[#085041] uppercase text-[9.5px] border-b">
                            📑 TABLEAU RECAPITULATIF DES PRESTATIONS EFFECTUÉES DU MOIS :
                          </td>
                        </tr>
                        {activeMissionsList.map((m, idx) => {
                          const missionPriceHT = m.prixFixe || (m as any).prixConvenu || 80000;
                          const missionTTC = Math.round(missionPriceHT * 1.19);
                          return (
                            <tr key={m.id || idx} className="border-b border-slate-100 text-[11px] hover:bg-slate-50/50">
                              <td className="p-3">
                                <div className="font-bold text-slate-900">
                                  Prestation unique : unique-course ➔ {m.id}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  <b>Trajet :</b> {m.depart} ➔ {m.arrivee} ({m.marchandise}) • <b>Date d'exécution :</b> {m.dateLivraison}
                                </div>
                              </td>
                              <td className="p-3 text-right font-mono text-slate-700">
                                {missionPriceHT.toLocaleString()} DA
                              </td>
                              <td className="p-3 text-center font-mono text-slate-550">
                                19%
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900">
                                {missionTTC.toLocaleString()} DA
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    ) : (
                      /* NORMAL SINGLE TRANSACTION CASE */
                      <tr className="border-b border-slate-150 font-medium">
                        <td className="p-4">
                          <p className="font-extrabold text-slate-900">
                            🚚 Prestation de transport routier de fret national
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            <b>Commande Bourse Fret :</b> {offre?.id || "OFFRE-102"} • Itinéraire de transit : <b>{offre?.depart || "Alger"} ➔ {offre?.arrivee || "Bejaïa"}</b> <br />
                            <b>Marchandise :</b> {offre?.marchandise || "Aliments pour bétail"} • Camion requis : <b>{offre?.moyenExige || "Fourgon"}</b> <br />
                            Date livraison confirmée le : <b>{offre?.dateLivraison || todayDateStr}</b>
                          </p>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-700">
                          {totalHT.toLocaleString()} DA
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-slate-500">
                          19%
                        </td>
                        <td className="p-4 text-right font-mono font-black text-[#1D9E75]">
                          {totalTTC.toLocaleString()} DA
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* TOTALS RECAPP */}
              <div className="flex justify-end pt-1">
                <div className="w-80 space-y-2 text-right text-xs">
                  <div className="flex justify-between px-2 text-slate-500 font-bold">
                    <span>Base d'imposition HT :</span>
                    <span className="font-mono text-slate-900">{totalHT.toLocaleString()} DZD</span>
                  </div>
                  <div className="flex justify-between px-2 text-slate-500 font-bold">
                    <span>TVA Nationale de Transport (19%) :</span>
                    <span className="font-mono text-slate-800">{computedTVA.toLocaleString()} DZD</span>
                  </div>
                  <div className="flex justify-between font-black text-slate-950 bg-[#1D9E75]/10 p-3 rounded-2xl text-sm leading-none items-center">
                    <span>TOTAL TTC À REGLER :</span>
                    <span className="font-mono text-slate-950 text-base">
                      {totalTTC.toLocaleString()} DZD
                    </span>
                  </div>
                </div>
              </div>

              {/* BANK COORDINATES AND RIB INFO */}
              <div className="border-t border-dashed border-slate-200 pt-4 leading-normal text-[10px] text-slate-450">
                <div className="font-sans">
                  <strong className="text-slate-800">CORDONNÉES BANCAIRES POUR VIREMENT ET VERSEMENT (ALGERIE) :</strong>
                  <p className="mt-1">
                    <b>Banque Référente :</b> BDL (Banque du Développement Local), Agence 104 Bir Mourad Rais, Alger.<br />
                    <b>Bénéficiaire Officiel :</b> SARL SOLUTIONS LOGISTIQUES NETLOG DZ<br />
                    <b>Numéro de Compte RIB (BDL Algérie) :</b> 
                    <span className="bg-slate-100 font-mono text-slate-900 font-bold px-1.5 py-0.5 rounded ml-1 tracking-wider text-[11px]">
                      005 00104 1234567890 55
                    </span>
                    <br />
                    Pour BaridiMob CCP Algerie utilisez le RIP : <span className="font-mono font-bold">007999990022334455-88</span>.
                  </p>
                  <p className="mt-2 italic font-semibold text-[#085041]">
                    Veuillez spécifier la référence de facturation certifiée {codeUnique} dans l’objet de votre virement ou chèque pour accélérer la validation comptable administrée de votre versement par le robot BVF.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* SIGNATURES MARGIN FOOTER (Always printable at the very bottom) */}
          <div className="mt-8 pt-4 border-t border-slate-100 text-center text-[9px] text-slate-400 font-mono">
            NETLOG ALGERIE — Document certifié conforme à la législation fiscale des transports routiers — Code Traçabilité Numérique : {codeUnique} — Édité le {dateDocument} 
          </div>

        </div>

        {/* NON-PRINTABLE MODAL ACTION BAR FOOTER */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center shrink-0 no-print">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <Shield className="w-4 h-4 text-[#1D9E75]" />
            Validation Cryptographique Certifiée Directe par la Plateforme Logistique Arbitrée NETLOG.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition cursor-pointer"
          >
            Fermer l'aperçu [✕]
          </button>
        </div>

      </div>
    </div>
  );
}
