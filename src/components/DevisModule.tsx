import React, { useState, useRef, useEffect } from "react";
import { 
  FileText, 
  CheckCircle, 
  FileSignature, 
  Printer, 
  Trash2, 
  Award, 
  Eye, 
  Smartphone, 
  Upload, 
  QrCode, 
  AlertCircle,
  Share2,
  XSquare,
  RefreshCw
} from "lucide-react";
import { DevisOfficiel, PropositionPrix, OffreFret, UserProfile } from "../types";

interface DevisModuleProps {
  role: "donneur" | "transporteur";
  currentUser: UserProfile;
  users: UserProfile[];
  offres: OffreFret[];
  propositions: PropositionPrix[];
  devis: DevisOfficiel[];
  saveState: (
    updatedUsers?: any,
    updatedMoyens?: any,
    updatedOffres?: any,
    updatedProps?: any,
    updatedFactures?: any,
    updatedDevis?: DevisOfficiel[]
  ) => void;
  triggerSystemLog: (msg: string, type: "success" | "info" | "warning" | "danger") => void;
  lang: string;
  translateCity: (city: string, lang: string) => string;
}

export default function DevisModule({
  role,
  currentUser,
  users,
  offres,
  propositions,
  devis,
  saveState,
  triggerSystemLog,
  lang,
  translateCity
}: DevisModuleProps) {
  // Navigation & Sub-states
  const [activeDevisTab, setActiveDevisTab] = useState<"liste" | "comparateur">("liste");
  const [viewingDevis, setViewingDevis] = useState<DevisOfficiel | null>(null);
  const [signingDevis, setSigningDevis] = useState<DevisOfficiel | null>(null);
  
  // Signature States
  const [sigType, setSigType] = useState<"drawn" | "typed" | "otp" | "cachet">("drawn");
  const [typedName, setTypedName] = useState(currentUser.raisonSociale || `${currentUser.prenom} ${currentUser.nom}`);
  const [typedFontClass, setTypedFontClass] = useState<string>("font-serif italic text-xl");
  
  // OTP States
  const [otpSentCode, setOtpSentCode] = useState<string>("");
  const [otpInput, setOtpInput] = useState<string>("");
  const [otpSecsLeft, setOtpSecsLeft] = useState<number>(0);

  // Cachet States
  const [uploadedCachet, setUploadedCachet] = useState<string | null>(null);
  const [selectedPresetCachet, setSelectedPresetCachet] = useState<string>("red-seal");

  // Canvas Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Comparator States
  const [selectedOfferForCompare, setSelectedOfferForCompare] = useState<string>("");
  const [selectedDevisIds, setSelectedDevisIds] = useState<string[]>([]);
  const [dossierMarketRef, setDossierMarketRef] = useState<string>("AON-NETLOG-2026-N08");
  const [institutionName, setInstitutionName] = useState<string>(currentUser.raisonSociale || "NETLOG INSTITUTIONNEL");
  const [signedVisaDO, setSignedVisaDO] = useState<boolean>(false);

  // Helper to dynamically check the state of quotes
  const getDevisStatut = (d: DevisOfficiel): "demande" | "signe" | "expire" | "refuse" => {
    if (d.statut === "refuse" || d.status === "refuse") return "refuse";
    
    // Check if 48h limit since dateCreation is exceeded
    const createdDate = d.dateCreation ? new Date(d.dateCreation) : new Date(d.dateEmission);
    const fortyEightHoursMs = 48 * 60 * 60 * 105 * 10 * 10; // 48h in ms = 48 * 3600 * 1000
    const diffMs = Date.now() - createdDate.getTime();
    const isExpired = diffMs > (48 * 60 * 60 * 1000);
    
    if (d.statut === "expire" || d.status === "expire" || (isExpired && !d.signatureTime)) {
      return "expire";
    }
    
    if (d.statut === "signe" || d.status === "Signé" || d.status === "Validé") {
      return "signe";
    }
    
    return "demande";
  };

  // Synchronous or Async SHA-256 Generator
  const calculateSHA256 = async (d: DevisOfficiel): Promise<string> => {
    try {
      const dataPayload = {
        id: d.id,
        offreId: d.offreId,
        propositionId: d.propositionId,
        doId: d.doId || d.donneurId,
        transporteurId: d.transporteurId,
        montantHT: d.montantHT || d.prixHT,
        tva: d.tva,
        montantTTC: d.montantTTC || d.prixTTC,
        dateCreation: d.dateCreation || d.dateEmission
      };
      
      const encoder = new TextEncoder();
      const stringData = JSON.stringify(dataPayload);
      const data = encoder.encode(stringData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // standard fallback
      const payload = `${d.id}-${d.prixHT}-${d.dateEmission}-${d.transporteurRaisonSociale}`;
      let hash = 0;
      for (let i = 0; i < payload.length; i++) {
        hash = (hash << 5) - hash + payload.charCodeAt(i);
        hash |= 0;
      }
      return `${Math.abs(hash).toString(16).toUpperCase()}`;
    }
  };

  // Initialize Canvas when signingDevis is set
  useEffect(() => {
    if (signingDevis && sigType === "drawn") {
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.strokeStyle = "#1A1A2E";
            ctx.lineWidth = 2.5;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = 140; 
            ctx.fillStyle = "#F8FAFC";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [signingDevis, sigType]);

  // Handle countdown for SMS simulation
  useEffect(() => {
    let timer: any = null;
    if (otpSecsLeft > 0) {
      timer = setInterval(() => {
        setOtpSecsLeft((p) => p - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [otpSecsLeft]);

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (e.cancelable) e.preventDefault();

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Generate simulated SMS OTP
  const sendSMSOTP = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpSentCode(randomCode);
    setOtpSecsLeft(60);
    setOtpInput("");
    
    triggerSystemLog(`[SÉCURITÉ NETLOG] Votre code de signature officiel à 6 chiffres est : ${randomCode} (Simulation SMS).`, "info");
    if ((window as any).showToast) {
      (window as any).showToast(`📱 SMS envoyé : ${randomCode} (Simulation)`, "info");
    }
  };

  // Trigger Signature Confirmation
  const confirmSignature = async () => {
    if (!signingDevis) return;

    let finalSigType = sigType;
    let finalSignatureDessinee = undefined;
    let finalSignatureTapee = undefined;
    let finalCachet = undefined;

    if (sigType === "drawn") {
      const canvas = canvasRef.current;
      if (canvas) {
        finalSignatureDessinee = canvas.toDataURL("image/png");
      }
    } else if (sigType === "typed") {
      if (!typedName) {
        triggerSystemLog("Le nom pour la signature ne peut pas être vide.", "danger");
        return;
      }
      finalSignatureTapee = typedName;
    } else if (sigType === "otp") {
      if (otpInput !== otpSentCode || !otpSentCode) {
        triggerSystemLog("Code de sécurité OTP invalide.", "danger");
        return;
      }
    } else if (sigType === "cachet") {
      finalCachet = uploadedCachet || "seal-preset-official";
    }

    // Prepare updated state
    const targetIdx = devis.findIndex(d => d.id === signingDevis.id);
    if (targetIdx === -1) return;

    const baseDevis = devis[targetIdx];
    const signedDevisObj: DevisOfficiel = {
      ...baseDevis,
      status: "Signé",
      statut: "signe",
      signatureType: finalSigType,
      signatureDessinee: finalSignatureDessinee,
      signatureTapee: finalSignatureTapee,
      signatureTime: new Date().toISOString().replace('T', ' ').substring(0, 19) + " UTC",
      signatureIP: `${Math.floor(Math.random() * 80 + 105)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254 + 1)}`,
      cachetImagePath: finalCachet || (selectedPresetCachet ? `preset-${selectedPresetCachet}` : undefined),
      signatureData: finalSignatureDessinee || finalSignatureTapee || "FIRM_SIGNED_OTP_" + otpInput,
      timestampSignature: new Date().toISOString(),
      ipSignataire: `197.200.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`,
      methodSignature: finalSigType === "drawn" ? "dessinee" : finalSigType === "typed" ? "tapee" : finalSigType === "cachet" ? "cachet" : "otp",
      cachetsTransporteur: finalCachet || `preset-${selectedPresetCachet}`
    };

    const docHash = await calculateSHA256(signedDevisObj);
    signedDevisObj.hashSHA256 = docHash;
    signedDevisObj.hashDocument = docHash;

    const updatedDevis = devis.map((d) => d.id === signingDevis.id ? signedDevisObj : d);

    // Save and alert
    saveState(undefined, undefined, undefined, undefined, undefined, updatedDevis);
    triggerSystemLog(`Le devis ${signingDevis.id} a été signé électroniquement et transmis !`, "success");
    setSigningDevis(null);
  };

  // Refuse Devis Action
  const handleRefuseDevis = (d: DevisOfficiel) => {
    if (window.confirm(`Êtes-vous sûr de vouloir refuser de signer ce devis officiel (${d.id}) ?`)) {
      const updated = devis.map((item) => {
        if (item.id === d.id) {
          return { 
            ...item, 
            status: "expire" as any, 
            statut: "refuse" as any 
          };
        }
        return item;
      });
      saveState(undefined, undefined, undefined, undefined, undefined, updated);
      triggerSystemLog(`Vous avez décliné le devis ${d.id}.`, "warning");
    }
  };

  // Renew Devis Action (DO can renew expired request)
  const handleRenewDevis = (d: DevisOfficiel) => {
    if (window.confirm(`Voulez-vous renouveler la demande de devis ${d.id} pour réenclencher l'échéance de 48h ?`)) {
      const updated = devis.map((item) => {
        if (item.id === d.id) {
          return { 
            ...item, 
            status: "En attente signature" as any, 
            statut: "demande" as any,
            dateCreation: new Date().toISOString(),
            dateValidite: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0]
          };
        }
        return item;
      });
      saveState(undefined, undefined, undefined, undefined, undefined, updated);
      triggerSystemLog(`La demande pour le devis ${d.id} a été renouvelée. Le transporteur a de nouveau 48h pour signer.`, "success");
    }
  };

  // Share devis
  const handleShareDevis = (d: DevisOfficiel) => {
    const dummyUrl = `https://netlog.com.dz/verify/devis/${d.id}?hash=${d.hashDocument}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(dummyUrl).then(() => {
        triggerSystemLog(`Lien de partage officiel copié dans le presse-papier !`, "success");
      });
    } else {
      triggerSystemLog(`Lien de partage du devis : ${dummyUrl}`, "info");
    }
  };

  // Accept and conclude contract
  const approveAndValidateDevis = (d: DevisOfficiel) => {
    const next = devis.map(item => {
      if (item.id === d.id) {
        return { ...item, status: "Validé" as any };
      }
      return item;
    });

    // Accept original proposition and reject others for the same offer
    const matchingProp = propositions.find(p => p.id === d.propositionId);
    let updatedProps = propositions;
    if (matchingProp) {
      updatedProps = propositions.map(p => {
        if (p.id === matchingProp.id) return { ...p, status: "Accepté" as const };
        if (p.offreId === matchingProp.offreId && p.id !== matchingProp.id) return { ...p, status: "Rejeté" as const };
        return p;
      });
    }

    // Set matching offer to Attributed
    const matchingOffre = offres.find(o => o.id === d.offreId);
    let updatedOffres = offres;
    if (matchingOffre) {
      updatedOffres = offres.map(o => o.id === matchingOffre.id ? { ...o, status: "Attribué" as any } : o);
    }

    saveState(undefined, undefined, updatedOffres, updatedProps, undefined, next);
    triggerSystemLog(`Le devis ${d.id} est validé officiellement. Mission de transport concrétisée !`, "success");
    setViewingDevis({ ...d, status: "Validé" });
  };

  // Filter list of devis belonging to user role
  const renderedDevis = devis.filter((d) => {
    if (role === "donneur") {
      return d.donneurId === currentUser.id;
    } else {
      return d.transporteurId === currentUser.id;
    }
  });

  const offersWithBids = offres.filter(o => 
    (role === "donneur" ? o.donneurId === currentUser.id : true) &&
    devis.some(d => d.offreId === o.id)
  );

  const devisToCompare = devis.filter(d => 
    d.offreId === selectedOfferForCompare
  );

  const sortedDevisToCompare = [...devisToCompare].sort((a,b) => a.prixHT - b.prixHT);

  // Preset cachets
  const sealPresets = [
    { id: "red-seal", name: "Cachet Commercial Rouge" },
    { id: "blue-seal", name: "Cachet Sûreté Bleu" },
    { id: "teal-seal", name: "Certification Vert Émeraude" }
  ];

  return (
    <div className="space-y-6">
      
      {/* ----------------- SUB ACTIONS BAR & TABS ----------------- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 py-3.5 px-6 rounded-3xl gap-4 shadow-sm no-print">
        <div className="space-y-1">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase flex items-center gap-1.5 font-sans">
            <FileSignature className="w-4 h-4 text-teal-600" />
            {lang === "ar" ? "إدارة العروض التقديمية والتعاقد" : "Génération de Devis Officiels & Dossier Comparatif"}
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold leading-normal">
            Conforme à la Loi Algérienne n°15-04 relative à la signature et certificat électroniques.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveDevisTab("liste");
              setViewingDevis(null);
            }}
            style={
              activeDevisTab === "liste"
                ? { backgroundColor: '#0f172a', color: '#ffffff' }
                : { backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }
            }
            className="py-2 px-4 rounded-xl text-xs font-extrabold transition cursor-pointer hover:opacity-90"
          >
            📋 Tous les Devis ({renderedDevis.length})
          </button>
          
          {role === "donneur" && (
            <button
              onClick={() => {
                setActiveDevisTab("comparateur");
                setViewingDevis(null);
                if (offersWithBids.length > 0 && !selectedOfferForCompare) {
                  setSelectedOfferForCompare(offersWithBids[0].id);
                }
              }}
              style={
                activeDevisTab === "comparateur"
                  ? { backgroundColor: '#1C8c68', color: '#ffffff' }
                  : { backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }
              }
              className="py-2 px-4 rounded-xl text-xs font-extrabold transition cursor-pointer hover:opacity-90"
            >
              📊 Comparateur Structurel ({offersWithBids.length} Offres)
            </button>
          )}
        </div>
      </div>

      {/* ----------------- TAB: LIST OF QUOTES ----------------- */}
      {activeDevisTab === "liste" && !viewingDevis && !signingDevis && (
        <div className="grid grid-cols-1 gap-4 no-print">
          {renderedDevis.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500 shadow-sm flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-teal-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-teal-600/20 dark:text-teal-500/20">
                <FileText className="w-8 h-8 text-teal-600" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-[#1A1A2E] dark:text-white text-xs uppercase text-center">
                  Aucun devis officiel dans votre registre
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold leading-normal max-w-sm mx-auto text-center">
                  {role === "donneur" 
                    ? "Allez dans l'onglet 'Propositions reçues' et cliquez sur 'Demander un devis officiel' pour engager la démarche comparative." 
                    : "Les donneurs d'ordres n'ont pas encore requis de devis de votre part. Dès qu'une demande est émise, elle figurera ici."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {renderedDevis.map((d) => {
                const statutVal = getDevisStatut(d);
                const matchedOffre = offres.find(o => o.id === d.offreId);
                const finalValidity = d.dateValidite || new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0];
                
                // Formatted display values
                const printedHT = d.prixHT || d.montantHT || 0;
                const printedTVA = d.tva || Math.round(printedHT * 0.19);
                const printedTTC = d.prixTTC || d.montantTTC || Math.round(printedHT * 1.19);

                return (
                  <div key={d.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 hover:border-teal-500 dark:hover:border-teal-500 transition shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden">
                    
                    {/* Badge Stamp Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] text-teal-600 font-mono font-bold uppercase tracking-wider">{d.id}</span>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white mt-1 uppercase">
                          {role === "donneur" ? `De: ${d.transporteurRaisonSociale}` : `Pour: ${d.donneurRaisonSociale}`}
                        </h4>
                      </div>
                      
                      {/* Badge according to status */}
                      <div>
                        {statutVal === "demande" && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[8.5px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider block animate-pulse">
                            🟡 En attente de signature
                          </span>
                        )}
                        {statutVal === "signe" && (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[8.5px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider block">
                            🟢 Signé et transmis
                          </span>
                        )}
                        {statutVal === "expire" && (
                          <span className="bg-rose-50 text-rose-800 border border-rose-200 text-[8.5px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider block">
                            🔴 Expiré (48h dépassées)
                          </span>
                        )}
                        {statutVal === "refuse" && (
                          <span className="bg-slate-100 text-slate-800 border border-slate-200 text-[8.5px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider block">
                            ⚫ Refusé par vous
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Fret description box */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[10.5px] font-semibold text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                      <div className="flex justify-between">
                        <span>📍 Offre :</span>
                        <span className="text-slate-950 dark:text-white font-extrabold truncate max-w-[170px]">
                          {translateCity(d.depart, lang)} ➔ {translateCity(d.arrivee, lang)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>📦 Nature :</span>
                        <span className="text-slate-950 dark:text-white truncate max-w-[170px]">{d.marchandise || "Matériaux BTP"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>⚖️ Tonnage :</span>
                        <span className="text-slate-950 dark:text-white font-black">{d.poids || 30} tonnes</span>
                      </div>
                    </div>

                    {/* Prices Breakdown */}
                    <div className="space-y-1.5 pt-1 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Montant HT :</span>
                        <span>{printedHT.toLocaleString()} DA</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>TVA (19%) :</span>
                        <span>{printedTVA.toLocaleString()} DA</span>
                      </div>
                      <div className="flex justify-between text-teal-600 font-extrabold border-t pt-1 border-dashed border-slate-100 dark:border-slate-800">
                        <span>Total TTC :</span>
                        <span>{printedTTC.toLocaleString()} DA</span>
                      </div>
                    </div>

                    {/* Validity Date */}
                    <div className="text-[10px] text-slate-400 flex justify-between font-bold">
                      <span>Validité :</span>
                      <span>Jusqu'au {finalValidity}</span>
                    </div>

                    {/* Actions Row */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      
                      {statutVal === "demande" && (
                        <>
                          <button
                            onClick={() => setViewingDevis(d)}
                            style={{ backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }}
                            className="flex-1 py-1.5 px-2 hover:bg-slate-200 text-[10.5px] font-extrabold rounded-lg transition cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            👁️ Prévisualiser
                          </button>
                          
                          {role === "transporteur" && (
                            <>
                              <button
                                onClick={() => setSigningDevis(d)}
                                style={{ backgroundColor: '#1C8c68', color: '#ffffff' }}
                                className="flex-1 py-1.5 px-2.5 text-[10.5px] font-black rounded-lg shadow-xs transition cursor-pointer flex items-center justify-center gap-1 animate-pulse hover:bg-emerald-800"
                              >
                                <FileSignature className="w-3.5 h-3.5" />
                                ✍️ Signer
                              </button>
                              <button
                                onClick={() => handleRefuseDevis(d)}
                                style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
                                className="py-1.5 px-2 hover:bg-rose-100 text-[10.5px] font-bold rounded-lg transition cursor-pointer"
                                title="Refuser le devis"
                              >
                                ❌ Refuser
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {statutVal === "signe" && (
                        <>
                          <button
                            onClick={() => setViewingDevis(d)}
                            style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                            className="flex-1 py-2 hover:bg-slate-800 text-[10.5px] font-extrabold rounded-lg transition cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            👁️ Voir le devis signé
                          </button>
                          <button
                            onClick={() => handleShareDevis(d)}
                            style={{ backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }}
                            className="p-2 hover:bg-slate-200 text-[10.5px] font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1"
                            title="Partager le devis"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Partager
                          </button>
                        </>
                      )}

                      {statutVal === "expire" && (
                        <div className="w-full text-center py-2 text-[10px] font-bold text-rose-600 flex flex-col gap-2 bg-rose-50 dark:bg-rose-950/20 rounded-xl">
                          <span>⚠️ Échéance de signature dépassée (48h)</span>
                          {role === "donneur" && (
                            <button
                              onClick={() => handleRenewDevis(d)}
                              style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                              className="mx-auto py-1 px-3 hover:bg-red-700 text-[10px] font-black rounded-md flex items-center gap-1 cursor-pointer transition active:scale-95"
                            >
                              <RefreshCw className="w-3 h-3" />
                              🔄 Renouveler la demande
                            </button>
                          )}
                          {role === "transporteur" && (
                            <span className="text-slate-400 text-[9px] tracking-tight">Le DO peut renouveler la demande</span>
                          )}
                        </div>
                      )}

                      {statutVal === "refuse" && (
                        <div className="w-full text-center py-2 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl block">
                          ⚫ Ce devis a été refusé par vous.
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------- INTERACTIVE SIGNING DIALOG ----------------- */}
      {signingDevis && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md max-w-xl mx-auto space-y-6 no-print">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800/60">
            <div className="space-y-0.5">
              <span className="text-[9px] bg-teal-100 text-teal-800 font-extrabold tracking-widest px-2 py-0.5 rounded-md uppercase">CADRE JURIDIQUE SÉCURISÉ</span>
              <h4 className="text-xs font-black text-slate-950 dark:text-white uppercase mt-1">Signature Électronique — {signingDevis.id}</h4>
            </div>
            <button 
              onClick={() => setSigningDevis(null)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer font-bold"
            >
              Annuler ×
            </button>
          </div>

          <div className="p-4 bg-teal-50/50 dark:bg-teal-950/10 border border-teal-200/50 dark:border-teal-900/30 rounded-2xl text-[10.5px] text-teal-900 dark:text-teal-400 leading-relaxed font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-teal-600 dark:text-teal-500 shrink-0 mt-0.5" />
            <p>
              NETLOG applique un protocole d'authentification robuste conforme au décret Dématérialisation DZ. En signant ce document, vous validez la prestation de transport au tarif ferme mentionné.
            </p>
          </div>

          {/* Tab choices for signature method */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex text-center text-[10px] font-black uppercase tracking-wider gap-1">
            <button 
              type="button"
              onClick={() => setSigType("drawn")}
              className={`flex-1 py-2 rounded-xl transition cursor-pointer ${sigType === "drawn" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              🖍️ Dessinée
            </button>
            <button 
              type="button"
              onClick={() => setSigType("typed")}
              className={`flex-1 py-2 rounded-xl transition cursor-pointer ${sigType === "typed" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              ⌨️ Tapée
            </button>
            <button 
              type="button"
              onClick={() => setSigType("otp")}
              className={`flex-1 py-2 rounded-xl transition cursor-pointer ${sigType === "otp" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              📱 SMS OTP
            </button>
            <button 
              type="button"
              onClick={() => setSigType("cachet")}
              className={`flex-1 py-2 rounded-xl transition cursor-pointer ${sigType === "cachet" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              💮 Cachet
            </button>
          </div>

          <div className="space-y-4">
            
            {/* Draw signature */}
            {sigType === "drawn" && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[9.5px] text-slate-500 font-extrabold uppercase">Signez au doigt ou souris dans le rectangle blanc :</label>
                  <button onClick={clearCanvas} className="text-[9px] text-rose-500 uppercase font-black underline cursor-pointer">Effacer</button>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-1 bg-slate-50 overflow-hidden">
                  <canvas 
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full bg-slate-50 cursor-crosshair rounded-xl block h-36"
                  />
                </div>
              </div>
            )}

            {/* Typed signature */}
            {sigType === "typed" && (
              <div className="space-y-4 font-sans">
                <div className="space-y-1.5">
                  <label className="block text-[9.5px] text-slate-200 font-extrabold uppercase">Saisissez votre nom ou raison sociale d'entreprise :</label>
                  <input 
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-semibold focus:ring-1 focus:ring-teal-600 text-slate-950 dark:text-white focus:outline-none"
                    placeholder="Ex: SARL SAHARA EXPRESS"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { class: "font-serif italic text-lg tracking-wide bg-amber-50/40 text-teal-800", label: "Cursive Anglaise" },
                    { class: "font-mono italic text-base font-bold text-slate-800", label: "Cursive Rapide" },
                    { class: "font-sans italic font-bold text-indigo-900 underline", label: "Cursive Tracée" }
                  ].map((st, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTypedFontClass(st.class)}
                      className={`p-2.5 rounded-xl border text-center text-[10px] font-bold transition cursor-pointer ${
                        typedFontClass === st.class ? "bg-slate-950 border-slate-950 text-white" : "bg-white dark:bg-slate-800 border-slate-250 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="p-4 border border-dashed rounded-2xl bg-slate-50 dark:bg-slate-800 text-center flex flex-col justify-center items-center min-h-[90px] border-slate-200 dark:border-slate-700">
                  <span className="text-[8.5px] text-slate-400 uppercase font-black tracking-widest mb-1">Aperçu Cursif :</span>
                  <span className={`${typedFontClass} py-1.5 px-6 select-none bg-white dark:bg-slate-900 dark:text-teal-400 rounded-lg shadow-sm border`}>
                    {typedName || "Saisissez votre raison sociale..."}
                  </span>
                </div>
              </div>
            )}

            {/* OTP Signature */}
            {sigType === "otp" && (
              <div className="space-y-4 font-sans text-center">
                <div className="space-y-1 block max-w-sm mx-auto">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-extrabold block">Authentification par SMS OTP</span>
                  <p className="text-[10px] text-slate-400">
                    Sera envoyé sur votre numéro de téléphone KYC certifié ({currentUser.tel || "0550 12 34 56"}).
                  </p>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={sendSMSOTP}
                    disabled={otpSecsLeft > 0}
                    style={{ backgroundColor: '#1C8c68', color: '#ffffff' }}
                    className="py-2.5 px-5 rounded-xl font-bold text-[10px] uppercase cursor-pointer flex items-center gap-1.5 text-white transition active:scale-95 hover:bg-emerald-800"
                  >
                    <Smartphone className="w-4 h-4" />
                    {otpSecsLeft > 0 ? `Code envoyé (${otpSecsLeft}s)` : "📲 Recevoir mon code unique"}
                  </button>

                  {otpSentCode && (
                    <div className="space-y-2 block w-[200px] mx-auto pt-2">
                      <label className="text-[9.5px] text-slate-400 font-extrabold uppercase">Saisissez le code reçu :</label>
                      <input 
                        type="text"
                        maxLength={6}
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        className="w-full text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-705 text-slate-950 dark:text-white rounded-xl p-2 font-mono tracking-widest font-black focus:ring-1 focus:ring-teal-600 focus:outline-none"
                        placeholder="••••••"
                      />
                      {otpInput === otpSentCode ? (
                        <p className="text-[10px] text-emerald-600 font-bold">✓ Code valide !</p>
                      ) : otpInput.length === 6 ? (
                        <p className="text-[10px] text-rose-500 font-bold">❌ Code de sécurité erroné</p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cachet Stamping */}
            {sigType === "cachet" && (
              <div className="space-y-3 font-sans text-center">
                <div className="space-y-1 block max-w-sm mx-auto">
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-bold">Apposition du cachet officiel d'entreprise</label>
                  <p className="text-[10.5px] text-slate-400 mb-1">Choisissez un template certifié ou simulez la photo de votre propre cachet.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="space-y-2">
                    <label className="text-[9.5px] text-slate-500 font-black uppercase block">Modèles de cachet standard :</label>
                    <div className="space-y-1.5">
                      {sealPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setSelectedPresetCachet(preset.id);
                            setUploadedCachet(null);
                          }}
                          className={`w-full p-2 border rounded-xl flex items-center justify-between text-xs font-bold transition cursor-pointer ${
                            selectedPresetCachet === preset.id && !uploadedCachet ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          <span>{preset.name}</span>
                          <span className="text-[10px]">⚙️</span>
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <button 
                        type="button"
                        onClick={() => {
                          setUploadedCachet("img-cachet-photo-sahara-trucking");
                          setSelectedPresetCachet("");
                          triggerSystemLog("Cachet physique importé et vectorisé avec succès !", "success");
                        }}
                        className={`w-full py-2 px-3 border border-dashed text-center rounded-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                          uploadedCachet ? "bg-emerald-50 text-emerald-805 border-emerald-300" : "bg-white border-slate-300 hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {uploadedCachet ? "💮 VOTRE CACHET VECTORISÉ APPRAÎT" : "📸 SIMULER CACHET PHYSIQUE"}
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl border p-4 flex flex-col justify-center items-center h-[160px] text-center max-w-[200px] mx-auto border-slate-200">
                    <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider mb-2">Visuel de cachet choisi :</span>
                    
                    {uploadedCachet ? (
                      <div className="border-4 border-slate-800 text-slate-800 font-black uppercase text-[10px] tracking-widest font-mono p-3 rotate-6 rounded">
                        SARL SAHARA TRANS<br/>
                        <span className="text-[8px] text-teal-600">CERTIFIÉ PLATINUM</span><br/>
                        <span className="text-[7.5px] font-family text-slate-500 font-semibold">N° RC : 16/00-0987654B</span>
                      </div>
                    ) : (
                      <div className="scale-90">
                        {selectedPresetCachet === "red-seal" && (
                          <div className="border-4 border-dashed border-red-650 text-red-650 uppercase font-extrabold tracking-tighter text-[9.5px] p-2 rotate-3 rounded leading-none bg-white">
                            DEVIS TRANSPORT<br />
                            <span className="text-[7.5px] text-[#D85A30]">SARL VALIDÉE DZ</span><br />
                            <span className="font-mono text-[8.5px]">NIF 198716010023</span>
                          </div>
                        )}
                        {selectedPresetCachet === "blue-seal" && (
                          <div className="border-4 double border-blue-600 text-blue-600 font-extrabold block uppercase text-center rounded-full p-2 h-20 w-20 flex flex-col justify-center items-center bg-white leading-none text-[8.5px]">
                            PROFIL VERT<br />
                            <span className="text-[7.5px] font-mono font-black text-rose-500">DZ-OFFICIEL</span><br />
                            <span>NETLOG v2.3</span>
                          </div>
                        )}
                        {selectedPresetCachet === "teal-seal" && (
                          <div className="border-double border-4 border-teal-800 text-teal-805 uppercase font-black tracking-widest leading-none text-[9.5px] p-2.5 rotate-6 bg-white">
                            SECURE FLEET<br />
                            <span className="text-[7.5px] font-serif">ALGERIA DIRECT</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={() => setSigningDevis(null)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase rounded-xl transition cursor-pointer"
            >
              Fermer
            </button>
            <button
              onClick={confirmSignature}
              style={{ backgroundColor: '#1C8c68', color: '#ffffff' }}
              className="flex-1 py-2.5 text-white text-xs font-black uppercase rounded-xl shadow-xs transition cursor-pointer hover:bg-emerald-800"
            >
              ✒️ Appliquer ma signature certifiée
            </button>
          </div>
        </div>
      )}

      {/* ----------------- FULL A4 SHEET MODAL VIEW ----------------- */}
      {viewingDevis && (
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-805 rounded-3xl p-6 md:p-8 shadow-md relative max-w-4xl mx-auto space-y-6">
          <button 
            onClick={() => setViewingDevis(null)}
            className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full bg-rose-600 hover:bg-rose-750 text-white cursor-pointer no-print font-bold shadow-md hover:scale-110 active:scale-95 transition-all z-20 flex items-center justify-center w-8 h-8 border-none"
            title="Fermer"
          >
            ✕
          </button>

          {/* Top Panel Actions */}
          <div className="flex flex-wrap gap-2 items-center justify-between pb-4 border-b dark:border-slate-800/60 no-print">
            <div className="space-y-0.5">
              <span className="text-[9px] text-[#1D9E75] font-black uppercase tracking-wider font-mono">BORDEREAU OFFICIEL : {viewingDevis.id}</span>
              <h3 className="text-sm font-black text-[#1A1A2E] dark:text-white uppercase">Inspection Réglementaire du Contrat</h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                style={{ backgroundColor: '#1D9E75', color: '#ffffff' }}
                className="py-2 px-4 hover:opacity-95 text-xs font-black uppercase rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition active:scale-95"
              >
                <Printer className="w-4 h-4" />
                Imprimer Devis (A4)
              </button>

              {role === "donneur" && getDevisStatut(viewingDevis) === "signe" && viewingDevis.status !== "Validé" && (
                <button
                  onClick={() => approveAndValidateDevis(viewingDevis)}
                  style={{ backgroundColor: '#1C8c68', color: '#ffffff' }}
                  className="py-2 px-4 hover:bg-emerald-800 text-xs font-black uppercase rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition active:scale-95"
                >
                  <CheckCircle className="w-4 h-4" />
                  Valider final & Signature d'Affrètement
                </button>
              )}
            </div>
          </div>

          {/* THE PRINTABLE DEVIS A4 SHEET */}
          <div className="p-8 md:p-12 border border-slate-200 rounded-3xl bg-white text-slate-900 relative block font-sans" id="a4-devis-print-sheet">
            {/* Header: Carrier Profile Logo and Devis Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-300">
              
              {/* Prestataire Details */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[8.5px] text-[#1D9E75] font-black uppercase tracking-widest font-mono">🏢 PRESTATAIRE LOGISTIQUE (TRANSPORTEUR)</span>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">{viewingDevis.transporteurRaisonSociale}</h2>
                </div>
                
                <div className="text-[10.5px] text-slate-500 space-y-1 font-medium leading-relaxed">
                  <p>📍 Adresse : <span className="text-slate-800 font-bold">{viewingDevis.transporteurAdresse || "Z.I. Rouiba Lot 14, Alger"}</span></p>
                  <p>📞 Tél : <span className="text-slate-800 font-bold">{viewingDevis.transporteurTel}</span></p>
                  <p>N° Registre Commerce (RC) : <span className="font-mono font-bold text-slate-800">{viewingDevis.transporteurNRC || "16/00-0987654B26"}</span></p>
                  <p>NIF : <span className="font-mono font-bold text-slate-800">{viewingDevis.transporteurNIF || "19871601002345600000"}</span></p>
                  <p>NIS N° : <span className="font-mono text-slate-800">{viewingDevis.transporteurNIS || "001601080029314"}</span></p>
                </div>
              </div>

              {/* Quote details */}
              <div className="text-left md:text-right space-y-4">
                <div className="space-y-0.5">
                  <span className="bg-slate-900 text-white text-[9px] font-black font-mono tracking-wider px-3 py-1 rounded inline-block uppercase">DEVIS DE TRANSPORT DE MARCHANDISES</span>
                  <p className="text-xs font-mono font-black text-slate-900 mt-1">Référence : {viewingDevis.id}</p>
                </div>

                <div className="text-[10.5px] text-slate-500 space-y-1 font-semibold">
                  <p>Date d’établissement : <span className="text-slate-900">{viewingDevis.dateCreation ? viewingDevis.dateCreation.substring(0,10) : viewingDevis.dateEmission}</span></p>
                  <p>Validité de l'offre : <span className="text-rose-600 font-bold">15 jours</span> (jusqu'au {viewingDevis.dateExpiration ? viewingDevis.dateExpiration.substring(0,10) : viewingDevis.dateValidite})</p>
                  <p>Statut : <span className="text-teal-600 uppercase font-black">{viewingDevis.status === "Validé" ? "CONTRAT CONCLU" : viewingDevis.status}</span></p>
                </div>
              </div>

            </div>

            {/* Donneur d'Ordre info block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 my-4 border-b border-slate-300 text-[11px] leading-relaxed">
              <div className="p-3.5 bg-slate-50 border rounded-2xl">
                <span className="text-[8.5px] text-slate-400 font-black uppercase tracking-wider font-mono block mb-1">CLIENT (DONNEUR D'ORDRE)</span>
                <p className="font-black text-slate-900 text-xs">{viewingDevis.donneurRaisonSociale}</p>
                <p className="text-slate-500">📍 Adresse : Bab Ezzouar, Alger</p>
                <p className="text-slate-500">N° RC : 16/00-1234567B25</p>
                <p className="text-slate-500">NIF : 19851601004481200000</p>
              </div>

              <div className="p-3.5 bg-slate-50 border rounded-2xl">
                <span className="text-[8.5px] text-slate-400 font-black uppercase tracking-wider font-mono block mb-1">IDENTIFICATION DE L'OFFRE NETLOG</span>
                <p className="font-mono text-slate-900 text-xs font-black">Offre ID : {viewingDevis.offreId}</p>
                <p className="text-slate-500">Prestation : Transport routier lourd</p>
                <p className="text-slate-500">Régime juridique : Signature Électronique Décret 15-04</p>
                <p className="text-slate-500">Intermédiaire : Netlog Transport Algérie</p>
              </div>
            </div>

            {/* Services specification table */}
            <div className="space-y-4">
              <span className="text-[9.5px] text-slate-400 font-black uppercase tracking-wider font-mono block mb-1">DÉSIGNATION DE LA PRESTATION DIRECTE</span>
              
              <table className="w-full text-left text-xs font-sans rounded-2xl overflow-hidden border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 text-[10px] uppercase font-black border-b">
                    <th className="py-2.5 px-4">Description de la Prestation et Détails logistiques</th>
                    <th className="py-2.5 px-4 text-center">Quantité</th>
                    <th className="py-2.5 px-4 text-right">P.U. HT</th>
                    <th className="py-2.5 px-4 text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody className="text-slate-800 font-medium">
                  <tr className="border-b">
                    <td className="py-4 px-4 leading-normal">
                      <p className="font-black text-slate-900">Transport routier de marchandises (Fret Intérieur)</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        • Trajet : {translateCity(viewingDevis.depart, lang)} ➔ {translateCity(viewingDevis.arrivee, lang)}<br/>
                        • Nature : {viewingDevis.marchandise || "Acheminement BTP"}<br/>
                        • Tonnage : {viewingDevis.poids || 30} Tonnes<br/>
                        • Véhicule requis : Tautliner / Plateau DZ<br/>
                        • Immatriculation : 123456-116 (Agréé KYC)
                      </p>
                    </td>
                    <td className="py-4 px-4 text-center">1 Voyage</td>
                    <td className="py-4 px-4 text-right font-mono">{(viewingDevis.prixHT || viewingDevis.montantHT || 0).toLocaleString()} DA</td>
                    <td className="py-4 px-4 text-right font-mono font-black text-slate-900">{(viewingDevis.prixHT || viewingDevis.montantHT || 0).toLocaleString()} DA</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-500">Frais additionnels de manutention, sangles, bâche</td>
                    <td className="py-3 px-4 text-center">—</td>
                    <td className="py-3 px-4 text-right">0 DA</td>
                    <td className="py-3 px-4 text-right font-black text-teal-600">Inclus</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Prices summation HT TVA TTC */}
            <div className="pt-6 flex justify-end">
              <div className="w-full md:w-1/2 space-y-2 text-right text-xs font-semibold">
                <div className="flex justify-between text-slate-500 px-2">
                  <span>Sous-total HT :</span>
                  <span className="font-mono text-slate-900">{(viewingDevis.prixHT || viewingDevis.montantHT || 0).toLocaleString()} DA</span>
                </div>
                <div className="flex justify-between text-slate-500 px-2 pb-1.5 border-b">
                  <span>TVA Obligatoire Algérienne (19%) :</span>
                  <span className="font-mono text-slate-900">{(viewingDevis.tva || Math.round((viewingDevis.prixHT || viewingDevis.montantHT || 0) * 0.19)).toLocaleString()} DA</span>
                </div>
                <div className="flex justify-between text-teal-600 text-sm font-black bg-teal-50 p-3 rounded-xl border border-teal-100">
                  <span>TOTAL NET TTC IMPOSABLE :</span>
                  <span className="font-mono">{(viewingDevis.prixTTC || viewingDevis.montantTTC || 0).toLocaleString()} DA</span>
                </div>
              </div>
            </div>

            {/* Conditions Section */}
            <div className="mt-6 p-4 border rounded-2xl text-[10px] text-slate-500 leading-normal space-y-1 bg-slate-50 font-semibold">
              <span className="text-[8.5px] text-slate-400 font-extrabold block mb-1">CONDITIONS GÉNÉRALES ET D'EXÉCUTION :</span>
              <p>• Délai d'exécution : Enlèvement sous les délais indiqués sur l'offre Netlog, livraison sous 24 - 48 heures.</p>
              <p>• Conditions de paiement : 30 jours à dater de la fin de mission, sauf stipulation contraire acceptée entre les parties.</p>
              <p>• Validité de l'offre : 15 jours à compter de la date ci-dessus.</p>
              <p>• Assurance marchandise : Incluse (RC professionnelle transporteur DZ valide).</p>
              <p>• Le transporteur atteste être titulaire d'une autorisation de transport en cours de validité et d'une assurance RC.</p>
            </div>

            {/* Mentions Legales */}
            <div className="mt-4 text-[9.5px] text-slate-400 text-justify leading-relaxed block italic">
              <strong>MENTIONS LÉGALES :</strong> Devis établi via la plateforme NETLOG – Bourse de Fret Algérie. Ce document vaut engagement du prestataire pendant sa durée de validité. Conformément à la loi algérienne sur la signature électronique n'15-04 du 01/02/2015 relative aux transactions administratives numérisées.
            </div>

            {/* Verification and Certificate signatures footer block */}
            <div className="mt-6 pt-6 border-t border-slate-300 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-800">
              
              {/* Prestataire Carrier Signature Zone */}
              <div className="p-4 border border-dashed rounded-2xl bg-slate-50/50 flex flex-col justify-between min-h-[140px] text-center relative overflow-hidden">
                <span className="text-[8.5px] text-slate-400 font-black tracking-widest uppercase block mb-1">SIGNATURE TRANSPORTEUR</span>
                
                {viewingDevis.status !== "Signé" && viewingDevis.status !== "Validé" ? (
                  <div className="my-auto py-3">
                    <span className="text-[10px] text-rose-500 font-black uppercase tracking-wider block animate-pulse">✍️ EN ATTENTE DE SIGNATURE</span>
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center justify-center space-y-1">
                    {viewingDevis.signatureType === "drawn" && viewingDevis.signatureDessinee ? (
                      <img src={viewingDevis.signatureDessinee} alt="Signature" className="h-12 w-auto object-contain select-none" />
                    ) : (
                      <span className="font-serif italic font-bold text-teal-700 text-sm">
                        {viewingDevis.signatureTapee || viewingDevis.transporteurRaisonSociale}
                      </span>
                    )}
                    <span className="text-[8.5px] text-slate-400 block font-mono">Signé le {viewingDevis.signatureTime || viewingDevis.timestampSignature?.substring(0,19)}</span>
                    <span className="text-[8px] text-slate-400 block font-mono">IP: {viewingDevis.signatureIP || viewingDevis.ipSignataire}</span>
                  </div>
                )}
                
                <div className="text-[8.5px] text-slate-400 font-bold border-t pt-1.5 mt-1">Date : {viewingDevis.signatureTime?.substring(0,10) || "—"}</div>
              </div>

              {/* Visa Netlog Verification */}
              <div className="p-4 border rounded-2xl bg-slate-50/50 flex flex-col justify-between items-center text-center">
                <span className="text-[8.5px] text-slate-400 font-black tracking-widest uppercase block">VISA NETLOG — CERTIFIÉ CONFORME</span>
                
                <div className="p-1 bg-white border rounded-xl shadow-xs my-2">
                  {/* Real Dynamic QR code */}
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent("Devis:" + viewingDevis.id + "\nHash:" + (viewingDevis.hashDocument || viewingDevis.hashSHA256 || "PENDING"))}`} 
                    alt="QR Code" 
                    className="w-16 h-16 block"
                  />
                </div>

                <div className="space-y-0.5">
                  <span className="text-[8px] text-teal-600 font-black block">✓ AUTHENTIQUE & VÉRIFIÉ</span>
                  <p className="text-[8px] font-mono text-slate-400 truncate max-w-[190px]">{viewingDevis.hashDocument || viewingDevis.hashSHA256 || "Génération à la signature..."}</p>
                  <p className="text-[7.5px] font-mono text-slate-400">netlog.com.dz</p>
                </div>
              </div>

            </div>

          </div>

          <div className="pt-2 text-right no-print">
            <button 
              onClick={() => setViewingDevis(null)}
              style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
              className="px-6 py-2.5 hover:bg-slate-800 rounded-xl text-xs font-black uppercase cursor-pointer"
            >
              Fermer la vue Devis
            </button>
          </div>
        </div>
      )}

      {/* ----------------- MULTI-CRITERIA COMPARATOR RAPPORT ----------------- */}
      {activeDevisTab === "comparateur" && role === "donneur" && (
        <div className="space-y-6">
          
          {/* Top selection area */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4 no-print">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-350 font-bold">
                <label>🎯 1. Choisissez une offre de fret à analyser :</label>
                <select
                  value={selectedOfferForCompare}
                  onChange={(e) => {
                    setSelectedOfferForCompare(e.target.value);
                    setSelectedDevisIds([]); 
                  }}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold text-xs cursor-pointer focus:ring-1 focus:ring-teal-600 focus:outline-none"
                >
                  {offersWithBids.length === 0 ? (
                    <option value="">Aucune offre avec devis existante</option>
                  ) : (
                    offersWithBids.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} ({translateCity(o.depart, lang)} ➔ {translateCity(o.arrivee, lang)} - {o.marchandise})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-350 font-bold">
                <label>🏢 2. Informations de l'Institution ou Organisme :</label>
                <input 
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:ring-1 focus:ring-teal-600 focus:outline-none"
                  placeholder="Ex: SARL BATIMEX LOGISTIQUE"
                />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-350 font-bold">
                <label>📜 Référence du Devis / Comparatif Public :</label>
                <input 
                  type="text"
                  value={dossierMarketRef}
                  onChange={(e) => setDossierMarketRef(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-teal-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 text-[10.5px] text-slate-400 font-semibold flex items-center">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl leading-normal w-full">
                  ✓ Cochez au moins 2 devis ci-dessous pour déclencher l'algorithme d'analyse comparative de la bourse de fret.
                </div>
              </div>
            </div>

            {/* Checkbox devis targets selector */}
            {selectedOfferForCompare && (
              <div className="space-y-2 pt-3 border-t">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">3. Cochez les devis officiels reçus à porter au dossier d'analyse comparatif :</span>
                
                {devisToCompare.length === 0 ? (
                  <p className="text-[11px] text-[#D85A30] italic font-semibold">Aucun devis officiel disponible pour cette offre. Demandez d'abord la conversion.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {devisToCompare.map((d) => {
                      const isSelected = selectedDevisIds.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedDevisIds(prev => prev.filter(id => id !== d.id));
                            } else {
                              setSelectedDevisIds(prev => [...prev, d.id]);
                            }
                          }}
                          style={
                            isSelected 
                              ? { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#0f172a' } 
                              : { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }
                          }
                          className="py-2.5 px-3.5 rounded-xl border text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 hover:opacity-90"
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => {}} 
                            className="mr-1.5 cursor-pointer accent-teal-600"
                          />
                          {d.id} ({d.transporteurRaisonSociale || "Transporteur"}) — {(d.prixTTC || d.montantTTC || 0).toLocaleString()} DA
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RENDERING MATRIX COMPARATOR RAPPORT */}
          {selectedDevisIds.length < 2 ? (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center text-slate-400 text-xs italic no-print">
              📭 Veuillez sélectionner au moins 2 devis reçus ci-dessus pour générer l'analyse comparative officielle requise pour constituer votre dossier d'affrètement.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center no-print">
                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Aperçu du Dossier Comparatif d'Affrètement</h4>
                <button
                  onClick={() => window.print()}
                  style={{ backgroundColor: '#1C8c68', color: '#ffffff' }}
                  className="py-2.5 px-4 text-white text-xs font-black uppercase rounded-xl flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer hover:bg-emerald-800"
                >
                  <Printer className="w-4 h-4" />
                  Exporter & Imprimer Dossier (A4)
                </button>
              </div>

              <div className="p-8 bg-white border border-slate-200 rounded-3xl shadow-md text-slate-900 space-y-6 block font-sans" id="a4-comparative-dossier-print">
                
                {/* Visual Header */}
                <div className="text-center space-y-1.5 border-b-2 border-slate-900 pb-5">
                  <p className="text-[10px] font-family uppercase tracking-widest font-black text-slate-500">RAPPORT D'ANALYSE COMPARATIVE DE PRIX D'AFFRÈTEMENT</p>
                  <h2 className="text-sm font-black uppercase tracking-wider font-serif text-slate-900">{institutionName}</h2>
                  <p className="text-[8.5px] text-slate-400 font-mono">Commission Interne d'évaluation Logistique — Plateforme Certifiée NETLOG</p>
                  
                  <div className="pt-2 flex justify-between items-end text-[10.5px] font-bold text-slate-500 italic px-2">
                    <span>Référence Offre : <span className="font-mono text-slate-900 not-italic font-black">{selectedOfferForCompare}</span></span>
                    <span>Dossier comparatif Réf : <span className="font-mono text-[#D85A30] not-italic font-black">{dossierMarketRef}</span></span>
                    <span>Date d'édition : <span className="text-slate-900 not-italic font-black">{new Date().toISOString().split('T')[0]}</span></span>
                  </div>
                </div>

                <div className="space-y-1 text-center">
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">TABLEAU DE SYNTHÈSE DES DEMANDES DE TRAIN DE DEVIS</h3>
                  <p className="text-[9px] text-slate-500 font-semibold">Analyse de placement automatique ordonné par le lauréat le moins-disant commercialement</p>
                </div>

                {/* Matrix Content table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-150">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-100 text-slate-950 uppercase font-black tracking-wider border-b text-[9.5px]">
                        <th className="py-2.5 px-4 font-bold">Critères Évalués</th>
                        {sortedDevisToCompare
                          .filter(d => selectedDevisIds.includes(d.id))
                          .map((d, idx) => {
                            const isCheapest = idx === 0;
                            return (
                              <th key={d.id} className={`py-2.5 px-4 text-center border-l font-black ${isCheapest ? "bg-emerald-50 text-emerald-900" : ""}`}>
                                {d.transporteurRaisonSociale}
                                {isCheapest && (
                                  <span className="block text-[8px] bg-[#1D9E75] text-white px-2 py-0.5 rounded uppercase font-black animate-pulse tracking-wide mt-1 mx-auto max-w-fit">Lauréat Moins-Disant</span>
                                )}
                              </th>
                            );
                          })}
                      </tr>
                    </thead>
                    <tbody className="text-slate-800 divide-y leading-tight">
                      <tr>
                        <td className="py-2.5 px-4 font-black text-slate-400 uppercase text-[8.5px]">ID Devis Netlog</td>
                        {sortedDevisToCompare
                          .filter(d => selectedDevisIds.includes(d.id))
                          .map((d) => (
                            <td key={d.id} className="py-2.5 px-4 text-center font-mono font-bold text-slate-800 border-l">
                              {d.id}
                            </td>
                          ))}
                      </tr>

                      <tr>
                        <td className="py-2.5 px-4 font-black text-slate-400 uppercase text-[8.5px]">Montant Brut Hors-Taxes</td>
                        {sortedDevisToCompare
                          .filter(d => selectedDevisIds.includes(d.id))
                          .map((d, index) => {
                            const printedHT = d.prixHT || d.montantHT || 0;
                            return (
                              <td key={d.id} className={`py-2.5 px-4 text-center border-l font-mono ${index === 0 ? "font-black text-emerald-700 bg-emerald-50/40" : ""}`}>
                                {printedHT.toLocaleString()} DA
                              </td>
                            );
                          })}
                      </tr>

                      <tr>
                        <td className="py-2.5 px-4 font-black text-slate-400 uppercase text-[8.5px]">Taxe de TVA (19%)</td>
                        {sortedDevisToCompare
                          .filter(d => selectedDevisIds.includes(d.id))
                          .map((d) => {
                            const printedHT = d.prixHT || d.montantHT || 0;
                            const printedTVA = d.tva || Math.round(printedHT * 0.19);
                            return (
                              <td key={d.id} className="py-2.5 px-4 text-center font-mono text-slate-500 border-l">
                                {printedTVA.toLocaleString()} DA
                              </td>
                            );
                          })}
                      </tr>

                      <tr className="bg-slate-50/50">
                        <td className="py-2.5 px-4 font-black text-slate-900 uppercase text-[8.5px]">Montant Total TTC Imposable</td>
                        {sortedDevisToCompare
                          .filter(d => selectedDevisIds.includes(d.id))
                          .map((d, index) => {
                            const printedTTC = d.prixTTC || d.montantTTC || 0;
                            return (
                              <td key={d.id} className={`py-2.5 px-4 text-center border-l font-mono text-sm font-black ${index === 0 ? "text-emerald-700 bg-emerald-50 font-extrabold" : "text-slate-900"}`}>
                                {printedTTC.toLocaleString()} DA
                              </td>
                            );
                          })}
                      </tr>

                      <tr>
                        <td className="py-2.5 px-4 font-black text-slate-400 uppercase text-[8.5px]">Délai Logistique Garanti</td>
                        {sortedDevisToCompare
                          .filter(d => selectedDevisIds.includes(d.id))
                          .map((d) => (
                            <td key={d.id} className="py-2.5 px-4 text-center border-l font-extrabold text-slate-700">
                              {d.delaiTransport || 2} Jours
                            </td>
                          ))}
                      </tr>

                      <tr>
                        <td className="py-2.5 px-4 font-black text-slate-400 uppercase text-[8.5px]">Statut Accord Signature</td>
                        {sortedDevisToCompare
                          .filter(d => selectedDevisIds.includes(d.id))
                          .map((d) => {
                            const activeStatut = getDevisStatut(d);
                            return (
                              <td key={d.id} className="py-2.5 px-4 text-center border-l font-bold">
                                {activeStatut === "demande" ? (
                                  <span className="text-amber-750 bg-amber-50 rounded-full px-2 py-0.5 text-[8px] uppercase font-black">Demande en cours</span>
                                ) : activeStatut === "signe" ? (
                                  <span className="text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 text-[8px] uppercase font-black">✓ Signé Transporteur</span>
                                ) : activeStatut === "refuse" ? (
                                  <span className="text-slate-600 bg-slate-100 rounded-full px-2 py-0.5 text-[8px] uppercase font-black">Décliné</span>
                                ) : (
                                  <span className="text-rose-700 bg-rose-50 rounded-full px-2 py-0.5 text-[8px] uppercase font-black">Expiré</span>
                                )}
                              </td>
                            );
                          })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Intelligent recommendation */}
                {sortedDevisToCompare.length > 0 && (
                  <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl space-y-1 text-xs">
                    <h4 className="font-extrabold text-emerald-900 flex items-center gap-1 uppercase text-[10.5px]">
                      <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                      Conclusion d'attribution automatique :
                    </h4>
                    <p className="leading-relaxed text-emerald-800 text-[11px] font-semibold">
                      Le prestataire de transport **{sortedDevisToCompare[0].transporteurRaisonSociale}** référencé par le devis **{sortedDevisToCompare[0].id}** pour un budget global de **{(sortedDevisToCompare[0].prixTTC || sortedDevisToCompare[0].montantTTC || 0).toLocaleString()} DA TTC** est identifié comme le lauréat commercialement le plus avantageux. La prestation d'acheminement routier lui est attribuée conformément aux règlements.
                    </p>
                  </div>
                )}

                {/* Authority Signoffs boxes */}
                <div className="pt-6 border-t grid grid-cols-2 gap-8 text-center text-xs">
                  <div className="space-y-4">
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase block tracking-wider">Avis de conformité NETLOG</span>
                    <div className="border border-dashed p-6 rounded-2xl bg-slate-50 min-h-[90px] flex items-center justify-center italic text-[9.5px]">
                      Algorithme Bourse de Fret certifié
                    </div>
                  </div>

                  <div className="space-y-4">
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase block tracking-wider">Visa du Client (Donneur d'Ordre)</span>
                    
                    {signedVisaDO ? (
                      <div className="border border-dashed p-4 rounded-2xl bg-sky-50 min-h-[90px] flex flex-col items-center justify-center">
                        <span className="font-serif italic text-teal-700 font-black text-sm">
                          APPROUVÉ : {currentUser.raisonSociale || `${currentUser.prenom} ${currentUser.nom}`}
                        </span>
                        <span className="text-[8px] text-slate-400 font-mono block mt-1">Signé logistiquement le {new Date().toISOString().split('T')[0]}</span>
                      </div>
                    ) : (
                      <div className="border border-dashed p-4 rounded-2xl bg-slate-50 min-h-[90px] flex flex-col items-center justify-center space-y-1.5 no-print">
                        <p className="text-[9.5px] text-slate-400">En attente de visa d'autorité</p>
                        <button
                          onClick={() => {
                            setSignedVisaDO(true);
                            triggerSystemLog("Vous avez visé et approuvé ce dossier de comparaison !", "success");
                          }}
                          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                          className="py-1 px-3 hover:bg-slate-800 rounded text-[9px] uppercase font-black cursor-pointer shadow-xs transition"
                        >
                          ✒️ Signer le comparatif
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[9px] text-slate-500 font-semibold leading-relaxed text-center block max-w-lg mx-auto italic pt-2">
                  Généré pour le compte de {currentUser.raisonSociale || "NETLOG Customer"}. Plateforme Netlog Algérie, Alger Bab Ezzouar.
                </div>

              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
