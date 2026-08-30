import sys

PATH = "src/App.tsx"

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

def replace_once(content, old, new, label):
    count = content.count(old)
    if count != 1:
        print(f"❌ ÉCHEC sur '{label}' — trouvé {count} fois (attendu 1). RIEN n'a été modifié.")
        print("Renvoyez-moi : sed -n '4160,4200p' src/App.tsx (numéros de ligne actuels)")
        sys.exit(1)
    print(f"✅ '{label}' trouvé, remplacement effectué.")
    return content.replace(old, new, 1)

OLD = '''          const handleQuickPublishOfferSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if (!isDO) {
              triggerSystemLog("Interdit : Vous devez être connecté en tant que Donneur d'Ordre pour poster une offre.", "danger");
              return;
            }

            const newId = `offre-${offres.length + 1}`;
            const newOffer: OffreFret = {
              id: newId,
              donneurId: currentUser.id,
              donneurRaisonSociale: currentUser.raisonSociale || `${currentUser.prenom} ${currentUser.nom}`,
              depart: pubDepart,
              arrivee: pubArrivee,
              departDetails: `Entrepôt principal de ${pubDepart}`,
              arriveeDetails: `Dépôt client d'arrivée à ${pubArrivee}`,
              dateChargement: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
              dateLivraison: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
              poids: pubPoids,
              marchandise: pubMarchandise,
              moyenExige: pubMoyen,
              nombreVoyages: 1,
              prixFixe: pubPrix,
              status: OffreStatus.Publie,
              commentaire: pubCommentaire || "Acheminement rapide conforme aux normes NETLOG d'Algérie.",
              codeConfirmation: String(Math.floor(1000 + Math.random() * 9000)),
              dateCreation: new Date().toISOString()
            };

            const updatedOffres = [newOffer, ...offres];
            saveState(undefined, undefined, updatedOffres);
            triggerSystemLog(`Félicitations ! Votre offre de fret ${newId} (Axe: ${pubDepart} ➔ ${pubArrivee}) est publiée en direct sur la bourse de fret !`, "success");
            
            // Redirect to main listing!
            setCurrentTab("accueil");
          };'''

NEW = '''          const handleQuickPublishOfferSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!isDO) {
              triggerSystemLog("Interdit : Vous devez être connecté en tant que Donneur d'Ordre pour poster une offre.", "danger");
              return;
            }

            // freight_offers.wilaya_depart / wilaya_arrivee attendent un code
            // numérique (référence à wilayas.code, chargées depuis Supabase) ;
            // ce formulaire manipule des noms de wilaya (ex: "Alger").
            const wilayaDepartObj = wilayas.find(w => w.fr === pubDepart || w.ar === pubDepart);
            const wilayaArriveeObj = wilayas.find(w => w.fr === pubArrivee || w.ar === pubArrivee);
            if (!wilayaDepartObj || !wilayaArriveeObj) {
              triggerSystemLog("Wilaya non reconnue. Vérifiez votre saisie.", "danger");
              return;
            }

            const newId = `offre-${offres.length + 1}`;
            const newOffer: OffreFret = {
              id: newId,
              donneurId: currentUser.id,
              donneurRaisonSociale: currentUser.raisonSociale || `${currentUser.prenom} ${currentUser.nom}`,
              depart: pubDepart,
              arrivee: pubArrivee,
              departDetails: `Entrepôt principal de ${pubDepart}`,
              arriveeDetails: `Dépôt client d'arrivée à ${pubArrivee}`,
              dateChargement: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
              dateLivraison: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
              poids: pubPoids,
              marchandise: pubMarchandise,
              moyenExige: pubMoyen,
              nombreVoyages: 1,
              prixFixe: pubPrix,
              status: OffreStatus.Publie,
              commentaire: pubCommentaire || "Acheminement rapide conforme aux normes NETLOG d'Algérie.",
              codeConfirmation: String(Math.floor(1000 + Math.random() * 9000)),
              dateCreation: new Date().toISOString()
            };

            try {
              const inserted = await createFreightOffer({
                wilayaDepart: wilayaDepartObj.code,
                wilayaArrivee: wilayaArriveeObj.code,
                pointRepereDepart: `Entrepôt principal de ${pubDepart}`,
                pointRepereArrivee: `Dépôt client ${pubArrivee}`,
                description: pubCommentaire || "Acheminement rapide conforme aux normes NETLOG d'Algérie.",
                poidsKg: pubPoids ? Math.round(Number(pubPoids) * 1000) : undefined,
                typeMarchandise: pubMarchandise,
                // prix_propose est NOT NULL côté base : 0 signifie "prix à négocier"
                prixPropose: pubPrix ?? 0,
                paymentMethod: "cash",
                dateEnlevementSouhaitee: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
              });

              newOffer.id = String(inserted.id);

              setOffres(prev => [newOffer, ...prev]);
              triggerSystemLog(`Félicitations ! Votre offre de fret ${newOffer.id} (Axe: ${pubDepart} ➔ ${pubArrivee}) est publiée en direct sur la bourse de fret !`, "success");
              setCurrentTab("accueil");

            } catch (err) {
              const msg = err instanceof Error ? err.message : "Erreur inconnue";
              console.error("handleQuickPublishOfferSubmit:", msg);
              triggerSystemLog(`Erreur lors de la publication : ${msg}`, "danger");
            }
          };'''

content = replace_once(content, OLD, NEW, "handleQuickPublishOfferSubmit")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("\n🎉 Remplacement réussi. Fichier réécrit.")
