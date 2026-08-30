[1mdiff --git a/src/App.tsx b/src/App.tsx[m
[1mindex 877a628..447ec00 100644[m
[1m--- a/src/App.tsx[m
[1m+++ b/src/App.tsx[m
[36m@@ -844,20 +844,45 @@[m [mexport default function App() {[m
       console.error("Erreur rafraîchissement profils après connexion:", err);[m
     });[m
 [m
[31m-    // Route to dashboard[m
[31m-    if (user.profil === ProfileType.DonneurOrdre) {[m
[31m-      setCurrentTab("donneur");[m
[31m-    } else if (user.profil === ProfileType.Transporteur) {[m
[31m-      setCurrentTab("transporteur");[m
[31m-    } else if (user.profil === ProfileType.Chauffeur) {[m
[31m-      setCurrentTab("chauffeur");[m
[31m-    } else if (user.profil === ProfileType.Commercial) {[m
[31m-      setCurrentTab("commercial");[m
[31m-    } else if (user.profil === ProfileType.Admin) {[m
[31m-      setCurrentTab("admin");[m
[31m-    } else {[m
[31m-      setCurrentTab("accueil");[m
[31m-    }[m
[32m+[m[32m    // Route vers le dashboard correspondant au profil connecté[m
[32m+[m[32mswitch (user.profil) {[m
[32m+[m[32m  case ProfileType.DonneurOrdre:[m
[32m+[m[32m    setCurrentTab("donneur");[m
[32m+[m[32m    break;[m
[32m+[m
[32m+[m[32m  case ProfileType.Transporteur:[m
[32m+[m[32m    setCurrentTab("transporteur");[m
[32m+[m[32m    break;[m
[32m+[m
[32m+[m[32m  case ProfileType.Chauffeur:[m
[32m+[m[32m    setCurrentTab("chauffeur");[m
[32m+[m[32m    break;[m
[32m+[m
[32m+[m[32m  case ProfileType.Commercial:[m
[32m+[m[32m    setCurrentTab("commercial");[m
[32m+[m[32m    break;[m
[32m+[m
[32m+[m[32m  case ProfileType.Commissionnaire:[m
[32m+[m[32m    setCurrentTab("commissionnaire");[m
[32m+[m[32m    break;[m
[32m+[m
[32m+[m[32m  case ProfileType.Manutentionnaire:[m
[32m+[m[32m    setCurrentTab("manutentionnaire");[m
[32m+[m[32m    break;[m
[32m+[m
[32m+[m[32m  case ProfileType.Stockage:[m
[32m+[m[32m    setCurrentTab("stockage");[m
[32m+[m[32m    break;[m
[32m+[m
[32m+[m[32m  case ProfileType.Admin:[m
[32m+[m[32m    setCurrentTab("admin");[m
[32m+[m[32m    break;[m
[32m+[m
[32m+[m[32m  default:[m
[32m+[m[32m    console.error("[NETLOG] Profil sans dashboard :", user.profil);[m
[32m+[m[32m    setCurrentTab("accueil");[m
[32m+[m[32m    break;[m
[32m+[m[32m}[m
 [m
     triggerSystemLog(`Bienvenue de retour, ${user.prenom} !`, "success");[m
   };[m
[36m@@ -995,8 +1020,26 @@[m [mexport default function App() {[m
 [m
   // --- ACTIONS DONNEUR D'ORDRE ---[m
   const handleCreateOffre = async (e: React.FormEvent) => {[m
[31m-    e.preventDefault();[m
[31m-    if (!currentUser) return;[m
[32m+[m[32m  e.preventDefault();[m
[32m+[m
[32m+[m[32m  console.log("[NETLOG] handleCreateOffre déclenché", {[m
[32m+[m[32m    currentUserId: currentUser?.id,[m
[32m+[m[32m    currentUserProfil: currentUser?.profil,[m
[32m+[m[32m    formDepart,[m
[32m+[m[32m    formArrivee,[m
[32m+[m[32m    formPoids,[m
[32m+[m[32m    formMarchandise,[m
[32m+[m[32m    formPrixFixe,[m
[32m+[m[32m  });[m
[32m+[m
[32m+[m[32m  if (!currentUser) {[m
[32m+[m[32m    console.error("[NETLOG] Publication refusée : currentUser est null");[m
[32m+[m[32m    triggerSystemLog([m
[32m+[m[32m      "Impossible de publier : aucun utilisateur connecté.",[m
[32m+[m[32m      "danger"[m
[32m+[m[32m    );[m
[32m+[m[32m    return;[m
[32m+[m[32m  }[m
 [m
     // Code de confirmation aléatoire pour le déchargement[m
     const randomCode = Math.floor(1000 + Math.random() * 9000).toString();[m
[36m@@ -6753,4 +6796,4 @@[m [mexport default function App() {[m
 // Fonction utilitaire pour déterminer la limite de moyens du transporteur selon son abonnement fictif[m
 function umoyens_limit(userId: string): number {[m
   return 10;[m
[31m-}[m
[32m+[m[32m}[m
\ No newline at end of file[m
