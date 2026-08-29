import sys

PATH = "src/App.tsx"

OLD = '''            // INSERT Supabase
            const wilayaDepart = WILAYAS.find(w => w.fr === pubDepart || w.ar === pubDepart);
            const wilayaArrivee = WILAYAS.find(w => w.fr === pubArrivee || w.ar === pubArrivee);
            if (!wilayaDepart || !wilayaArrivee) {
              triggerSystemLog("Wilaya non reconnue. Verifiez votre saisie.", "danger");
              return;
            }
            try {
              const { data, error } = await supabase
                .from("freight_offers")
                .insert({
                  donneur_ordre_id: currentUser.id,
                  wilaya_depart: Number(wilayaDepart.code),
                  wilaya_arrivee: Number(wilayaArrivee.code),
                  point_repere_depart: "Entrepot principal de " + pubDepart,
                  point_repere_arrivee: "Depot client " + pubArrivee,
                  date_enlevement_souhaitee: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
                  poids_kg: Math.round(pubPoids * 1000),
                  type_marchandise: pubMarchandise,
                  type_moyen_exige: pubMoyen,
                  nombre_voyages: 1,
                  prix_propose: pubPrix ?? 0,
                  description: pubCommentaire || "Acheminement rapide NETLOG.",
                  payment_method: "cash",
                  status: "ouverte",
                })
                .select()
                .single();
              if (error) throw error;
              newOffer.id = String(data.id);
              newOffer.codeConfirmation = data.code_confirmation ?? "0000";
              newOffer.dateCreation = data.created_at;
              setOffres(prev => [newOffer, ...prev]);
              triggerSystemLog("Offre publiee sur la bourse NETLOG ! Axe: " + pubDepart + " vers " + pubArrivee, "success");
              setCurrentTab("accueil");
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Erreur inconnue";
              console.error("handleQuickPublishOfferSubmit:", msg);
              triggerSystemLog("Erreur publication: " + msg, "danger");
            }
          };'''

NEW = '''            // wilayas (renommé depuis WILAYAS le 2026-08-24, cf. migration
            // vers Supabase) — cette copie du formulaire n'avait pas été mise
            // à jour lors du renommage, d'où l'erreur "WILAYAS introuvable".
            const wilayaDepart = wilayas.find(w => w.fr === pubDepart || w.ar === pubDepart);
            const wilayaArrivee = wilayas.find(w => w.fr === pubArrivee || w.ar === pubArrivee);
            if (!wilayaDepart || !wilayaArrivee) {
              triggerSystemLog("Wilaya non reconnue. Verifiez votre saisie.", "danger");
              return;
            }
            try {
              // Appel à createFreightOffer (lib/freightOffers.ts) au lieu
              // d'un insert Supabase manuel dupliqué ici : une seule
              // implémentation de la création d'offre pour toute l'app.
              const data = await createFreightOffer({
                wilayaDepart: wilayaDepart.code,
                wilayaArrivee: wilayaArrivee.code,
                pointRepereDepart: "Entrepot principal de " + pubDepart,
                pointRepereArrivee: "Depot client " + pubArrivee,
                dateEnlevementSouhaitee: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
                poidsKg: Math.round(pubPoids * 1000),
                typeMarchandise: pubMarchandise,
                typeMoyenExige: pubMoyen,
                nombreVoyages: 1,
                prixPropose: pubPrix ?? 0,
                description: pubCommentaire || "Acheminement rapide NETLOG.",
                paymentMethod: "cash",
              });
              newOffer.id = String(data.id);
              newOffer.codeConfirmation = data.code_confirmation ?? "0000";
              newOffer.dateCreation = data.created_at;
              setOffres(prev => [newOffer, ...prev]);
              triggerSystemLog("Offre publiee sur la bourse NETLOG ! Axe: " + pubDepart + " vers " + pubArrivee, "success");
              setCurrentTab("accueil");
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Erreur inconnue";
              console.error("handleQuickPublishOfferSubmit:", msg);
              triggerSystemLog("Erreur publication: " + msg, "danger");
            }
          };'''

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

count = content.count(OLD)
if count == 0:
    print("❌ Texte exact introuvable — RIEN N'A ÉTÉ MODIFIÉ.")
    print("   Envoyez-moi : sed -n '4190,4234p' src/App.tsx")
    sys.exit(1)
elif count > 1:
    print(f"⚠️  Le texte apparaît {count} fois — remplacement annulé par sécurité.")
    sys.exit(1)
else:
    content = content.replace(OLD, NEW)
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("✅ Formulaire de publication rapide corrigé avec succès.")
