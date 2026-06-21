import React, { useEffect, useRef, useState } from "react";
import { OffreFret, MoyenTransport } from "../types";

interface LeafletMapProps {
  offres: OffreFret[];
  moyens: MoyenTransport[];
  onSelectOffre: (offre: OffreFret) => void;
  lang: "fr" | "ar";
}

// Coordinates map for key Algerian cities
const ALGERIAN_COORDINATES: Record<string, [number, number]> = {
  "Alger": [36.7538, 3.0588],
  "Oran": [35.6971, -0.6308],
  "Sétif": [36.1911, 5.4137],
  "Constantine": [36.3650, 6.6147],
  "Hassi Messaoud": [31.6784, 6.0722],
  "Béjaïa": [36.7511, 5.0560],
  "Touggourt": [33.1004, 6.0645],
  "Ouargla": [31.9493, 5.3250],
  "Annaba": [36.9000, 7.7667],
  "Ghardaïa": [32.4909, 3.6730],
  "Tamanrasset": [22.7850, 5.5228],
  "Biskra": [34.8500, 5.7333],
  "Adrar": [27.8742, -0.2939],
  "Djelfa": [34.6724, 3.2630],
  "Tlemcen": [34.8783, -1.3150]
};

export default function LeafletMap({ offres, moyens, onSelectOffre, lang }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Expose selecting function to Leaflet popups
  useEffect(() => {
    (window as any).handleMapSelectOffre = (offreId: string) => {
      const match = offres.find(o => o.id === offreId);
      if (match) {
        onSelectOffre(match);
      }
    };
    return () => {
      delete (window as any).handleMapSelectOffre;
    };
  }, [offres, onSelectOffre]);

  useEffect(() => {
    // Wait until Leaflet is present in window context
    const checkLeafletInterval = setInterval(() => {
      if ((window as any).L) {
        clearInterval(checkLeafletInterval);
        setMapLoaded(true);
      }
    }, 100);

    return () => clearInterval(checkLeafletInterval);
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Destroy existing instance to avoid react duplication issues
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Leaflet map centered on Algeria
    const map = L.map(mapContainerRef.current, {
      center: [28.0339, 1.6596],
      zoom: 5,
      scrollWheelZoom: true,
      zoomControl: true
    });

    mapInstanceRef.current = map;

    // Add OpenStreetMap tiles (high quality light styled map)
    const activeTheme = localStorage.getItem("netlog_theme");
    const tileUrl = activeTheme === "dark" 
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Create colored icons using standard visual markers or custom CSS DivIcons
    const greenMarkerSvg = `
      <svg class="w-8 h-8 filter drop-shadow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#1D9E75" stroke="white" stroke-width="1.5"/>
        <circle cx="12" cy="9" r="3" fill="white"/>
      </svg>
    `;

    const blueMarkerSvg = `
      <svg class="w-8 h-8 filter drop-shadow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
         <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#3B82F6" stroke="white" stroke-width="1.5"/>
         <circle cx="12" cy="9" r="3" fill="white"/>
      </svg>
    `;

    const greenIcon = L.divIcon({
      html: greenMarkerSvg,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
      className: "custom-leaflet-marker-green"
    });

    const blueIcon = L.divIcon({
      html: blueMarkerSvg,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
      className: "custom-leaflet-marker-blue"
    });

    // Offer Markers (Green 📍)
    offres.forEach(offre => {
      // Find approximate coordinates based on depart city
      const coords = ALGERIAN_COORDINATES[offre.depart] || ALGERIAN_COORDINATES["Alger"];
      // Add slight random offset to prevent direct overlap
      const offsetCoords: [number, number] = [
        coords[0] + (Math.random() - 0.5) * 0.15,
        coords[1] + (Math.random() - 0.5) * 0.15
      ];

      const popupContent = `
        <div class="p-2.5 font-sans space-y-1.5" style="min-width: 180px;">
          <div class="flex justify-between items-center bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
            <span class="text-[9px] font-black text-emerald-700 uppercase">📦 OFFRE ACTIVE</span>
            <span class="text-[10px] font-mono font-bold text-slate-800">${offre.id}</span>
          </div>
          <p class="font-extrabold text-xs text-slate-900 border-b border-dashed pb-1">
            ${offre.depart} ➔ ${offre.arrivee}
          </p>
          <div class="text-[10px] text-slate-600 font-medium space-y-0.5">
            <div><strong>Cargaison:</strong> ${offre.marchandise}</div>
            <div><strong>Tonnage:</strong> ${offre.poids} Tonnes</div>
            <div><strong>Prix Fixe:</strong> <span class="text-emerald-600 font-mono font-bold">${offre.prixFixe ? offre.prixFixe.toLocaleString() + " DA" : "Sur offre"}</span></div>
          </div>
          <button 
            onclick="window.handleMapSelectOffre('${offre.id}')"
            class="w-full mt-2 py-1 bg-[#1D9E75] text-white text-[10px] uppercase font-black tracking-wider rounded transition hover:bg-[#085041] cursor-pointer text-center"
          >
            🔍 Décrocher l'offre
          </button>
        </div>
      `;

      L.marker(offsetCoords, { icon: greenIcon })
        .addTo(map)
        .bindPopup(popupContent);
    });

    // Vehicle Markers (Blue 🚛)
    moyens.forEach(moyen => {
      const coords = ALGERIAN_COORDINATES[moyen.wilaya || "Alger"] || ALGERIAN_COORDINATES["Alger"];
      const offsetCoords: [number, number] = [
        coords[0] + (Math.random() - 0.5) * 0.2,
        coords[1] + (Math.random() - 0.5) * 0.2
      ];

      const popupContent = `
        <div class="p-2.5 font-sans space-y-1" style="min-width: 170px;">
          <div class="flex justify-between items-center bg-blue-50 px-2 py-1 rounded">
            <span class="text-[9px] font-black text-blue-700 uppercase">🚛 CAMION DISPO</span>
            <span class="text-[9px] bg-emerald-500 text-white px-1 py-0.5 rounded font-black">ACTIF</span>
          </div>
          <p class="font-extrabold text-xs text-slate-900 leading-tight">
            ${moyen.marque} - ${moyen.type}
          </p>
          <div class="text-[9.5px] text-slate-600 font-medium space-y-0.5 border-t border-slate-100 pt-1 mt-1">
            <div><strong>Position:</strong> ${moyen.wilaya || "Alger"}</div>
            <div><strong>Immat:</strong> <span class="font-mono text-slate-800 font-bold">${moyen.immatriculation}</span></div>
            <div><strong>Capacité:</strong> ${moyen.poidsUtileMax} Tonnes</div>
          </div>
        </div>
      `;

      L.marker(offsetCoords, { icon: blueIcon })
        .addTo(map)
        .bindPopup(popupContent);
    });

    // Make sure Leaflet map fits display on redraw/resize
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // Watch window resize for fit-redraw
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapLoaded, offres, moyens]);

  return (
    <div className="w-full h-full relative" style={{ minHeight: "450px" }}>
      {!mapLoaded && (
        <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-3 z-10 rounded-3xl border border-slate-200">
          <div className="w-8 h-8 rounded-full border-4 border-[#1D9E75] border-t-transparent animate-spin"></div>
          <span className="text-xs font-bold text-slate-400">
            {lang === "ar" ? "جاري تحميل خريطة الجزائر..." : "Chargement de la carte d'Algérie..."}
          </span>
        </div>
      )}
      <div id="leaflet-algeria-map" ref={mapContainerRef} className="w-full h-full rounded-2xl border border-slate-150 shadow-inner overflow-hidden" style={{ minHeight: "450px" }}></div>
    </div>
  );
}
