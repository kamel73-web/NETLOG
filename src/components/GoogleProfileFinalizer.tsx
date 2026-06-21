import React, { useState } from "react";
import { ProfileType } from "../types";
import { X, Phone, MapPin, Building2, Truck, AlertCircle } from "lucide-react";

interface GoogleProfileFinalizerProps {
  email: string;
  name: string;
  lang: "fr" | "ar";
  onCancel: () => void;
  onSubmit: (
    profile: ProfileType,
    options: { tel: string; wilaya: string; raisonSociale: string; nbCamions?: string }
  ) => void;
}

const WILAYAS_LIST = [
  "Alger", "Oran", "Constantine", "Sétif", "Béjaïa", "Blida", "Tizi Ouzou", 
  "Annaba", "Tlemcen", "Biskra", "Djelfa", "Batna", "M'Sila", "Chlef", 
  "Tébessa", "Bordj Bou Arreridj", "El Oued", "Adrar", "Ghardaïa", "Tamanrasset"
];

export function GoogleProfileFinalizer({
  email,
  name,
  lang,
  onCancel,
  onSubmit
}: GoogleProfileFinalizerProps) {
  const [profile, setProfile] = useState<ProfileType>(ProfileType.DonneurOrdre);
  const [tel, setTel] = useState("");
  const [wilaya, setWilaya] = useState("Alger");
  const [raisonSociale, setRaisonSociale] = useState(name ? `${name} Établissement` : "");
  const [nbCamions, setNbCamions] = useState("2-5");

  const [errorMsg, setErrorMsg] = useState("");

  const handleFinalize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tel.match(/^(05|06|07)[0-9]{8}$/)) {
      setErrorMsg(
        lang === "ar"
          ? "الرجاء إدخال رقم هاتف جزائري صالح (مثال: 0550123456)"
          : "Format de téléphone invalide (Exemple: 0550123456)"
      );
      return;
    }

    if (!raisonSociale.trim()) {
      setErrorMsg(
        lang === "ar"
          ? "يرجى ملء اسم الشركة أو الاسم التجاري"
          : "Veuillez préciser la raison sociale ou le nom commercial"
      );
      return;
    }

    setErrorMsg("");
    onSubmit(profile, {
      tel,
      wilaya,
      raisonSociale: raisonSociale.trim(),
      nbCamions: profile === ProfileType.Transporteur ? nbCamions : undefined
    });
  };

  return (
    <div className="bg-white rounded-[28px] max-w-lg w-full p-8 shadow-2xl border border-slate-100 flex flex-col space-y-6 relative max-h-[90vh] overflow-y-auto" id="google-profile-finalizer">
      <button
        onClick={onCancel}
        className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="text-center space-y-2">
        <div className="inline-flex p-3.5 bg-emerald-50 rounded-full text-emerald-600 mb-1">
          <svg className="w-8 h-8 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800">
          {lang === "ar" ? "أكمل ملفك الشخصي في NETLOG" : "Finalisez votre profil NETLOG"}
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          {lang === "ar"
            ? `مرحبًا ${name} (${email})، حدد نوع حسابك للأول مرة للبدء.`
            : `Bienvenue ${name} (${email}), veuillez configurer votre compte.`}
        </p>
      </div>

      <form onSubmit={handleFinalize} className="space-y-5">
        {/* Profile Choice Tab Group */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
            {lang === "ar" ? "نوع الحساب" : "Type de Profil"}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setProfile(ProfileType.DonneurOrdre);
                if (!raisonSociale || raisonSociale.endsWith("Transports")) {
                  setRaisonSociale(name ? `${name} Établissement` : "");
                }
              }}
              className={`p-4 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
                profile === ProfileType.DonneurOrdre
                  ? "border-[#1D9E75] bg-emerald-50/40 text-slate-800"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-500"
              }`}
            >
              <Building2 className={`w-6 h-6 ${profile === ProfileType.DonneurOrdre ? "text-[#1D9E75]" : ""}`} />
              <div className="text-xs font-bold">{lang === "ar" ? "طالب شحن (تاجر/شركة)" : "Donneur d'Ordre"}</div>
              <div className="text-[9.5px] leading-tight text-slate-400">Industriel, Import/Export, Usine</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfile(ProfileType.Transporteur);
                if (!raisonSociale || raisonSociale.endsWith("Établissement")) {
                  setRaisonSociale(name ? `${name} Transports` : "");
                }
              }}
              className={`p-4 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
                profile === ProfileType.Transporteur
                  ? "border-[#1D9E75] bg-emerald-50/40 text-slate-800"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-500"
              }`}
            >
              <Truck className={`w-6 h-6 ${profile === ProfileType.Transporteur ? "text-[#1D9E75]" : ""}`} />
              <div className="text-xs font-bold">{lang === "ar" ? "ناقل بري (مقدم خدمات)" : "Transporteur"}</div>
              <div className="text-[9.5px] leading-tight text-slate-400">Propriétaire de camions, Chauffeur</div>
            </button>
          </div>
        </div>

        {/* Common Phone and Wilaya Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold font-sans">
              {lang === "ar" ? "رقم الهاتف الحالي *" : "Numéro de Téléphone *"}
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="tel"
                required
                placeholder="0550123456"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1D9E75] font-mono text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold font-sans">
              {lang === "ar" ? "الولاية *" : "Wilaya d'intervention *"}
            </label>
            <div className="relative font-sans">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <select
                value={wilaya}
                onChange={(e) => setWilaya(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1D9E75] cursor-pointer text-slate-800 font-sans"
              >
                {WILAYAS_LIST.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Corporate Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold font-sans">
              {lang === "ar" ? "الاسم التجاري / الشركة *" : "Raison Sociale / Etablissement *"}
            </label>
            <input
              type="text"
              required
              placeholder={profile === ProfileType.DonneurOrdre ? "Ex: BATIMEX Algérie" : "Ex: SARL Fret Express DZ"}
              value={raisonSociale}
              onChange={(e) => setRaisonSociale(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1D9E75] text-slate-800"
            />
          </div>

          {profile === ProfileType.Transporteur && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold font-sans">
                {lang === "ar" ? "عدد الشاحنات في الأسطول" : "Taille de la flotte (Camions disponibles)"}
              </label>
              <select
                value={nbCamions}
                onChange={(e) => setNbCamions(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1D9E75] cursor-pointer text-slate-800"
              >
                <option value="1">1 camion (Chauffeur Artisan)</option>
                <option value="2-5">2 à 5 camions</option>
                <option value="6-20">6 à 20 camions</option>
                <option value="> 20">Plus de 20 camions (Flotte Entreprise)</option>
              </select>
            </div>
          )}
        </div>

        {/* Error Container */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-bold leading-none">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-650" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-all font-bold text-xs uppercase tracking-wide cursor-pointer text-center"
          >
            {lang === "ar" ? "إلغاء" : "Annuler"}
          </button>
          
          <button
            type="submit"
            className="flex-[2] py-3 bg-[#1D9E75] hover:bg-[#085041] text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wide cursor-pointer text-center shadow-lg hover:shadow-xl"
          >
            {lang === "ar" ? "تأكيد والتسجيل ➔" : "Valider l'Inscription ➔"}
          </button>
        </div>
      </form>
    </div>
  );
}
