import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Enable JSON bodies with higher limits for full state payloads
app.use(express.json({ limit: "50mb" }));

// In-memory global store to hold the synchronized state of the application across multiple devices
interface AppState {
  users?: any[];
  moyens?: any[];
  offres?: any[];
  propositions?: any[];
  factures?: any[];
  devis?: any[];
  lastUpdated?: number;
}

let globalState: AppState = {};

// API REST Endpoints (Evaluated BEFORE static or Vite middlewares)

// Helper to construct self-referential Redirect URI for Google Auth
function getGoogleRedirectUri(req: any) {
  if (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL" && !process.env.APP_URL.includes("localhost")) {
    const cleanUrl = process.env.APP_URL.replace(/\/$/, "");
    return `${cleanUrl}/auth/google/callback`;
  }
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host;
  return `${protocol}://${host}/auth/google/callback`;
}

// Check if real Google details are configured
function isGoogleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// GET auth Google URL
app.get("/api/auth/google/url", (req, res) => {
  if (isGoogleConfigured()) {
    const redirectUri = getGoogleRedirectUri(req);
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: "netlog_google_auth",
      access_type: "online",
      prompt: "select_account"
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url, isDemo: false });
  } else {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host;
    res.json({ url: `${protocol}://${host}/auth/google/demo-picker`, isDemo: true });
  }
});

// Serve the interactive Demo Google Account Picker
app.get(["/auth/google/demo-picker", "/auth/google/demo-picker/"], (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Se connecter avec Google - NETLOG</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Roboto', sans-serif; }
      </style>
    </head>
    <body class="bg-[#f0f4f9] min-h-screen flex items-center justify-center p-4">
      <div class="bg-white rounded-[28px] shadow-sm max-w-md w-full p-10 border border-[#e3e3e3] space-y-6">
        <div class="flex flex-col items-center space-y-4">
          <svg class="w-10 h-10" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <div class="text-center space-y-1">
            <h1 class="text-2xl font-normal text-[#1f1f1f]">Choisissez un compte</h1>
            <p class="text-[14px] text-[#444746]">pour continuer vers <span class="font-bold text-[#1D9E75]">NETLOG Broker</span></p>
          </div>
        </div>

        <div class="space-y-2">
          <!-- 1. Kamel -->
          <button onclick="selectAccount('do@batimex.dz', 'Kamel Babassi')" class="w-full flex items-center p-3 hover:bg-[#f7f8f9] rounded-xl transition-all border border-transparent hover:border-[#e3e3e3] active:bg-[#f2f2f2] text-left">
            <div class="w-8 h-8 rounded-full bg-[#1D9E75] text-white flex items-center justify-center text-xs font-bold mr-3 shrink-0">KB</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-[#1f1f1f] truncate">Kamel Babassi</p>
              <p class="text-xs text-[#5f6368] truncate">do@batimex.dz (Donneur d'Ordre)</p>
            </div>
          </button>

          <!-- 2. Mourad -->
          <button onclick="selectAccount('transporteur@fret-dz.com', 'Mourad Kasdi')" class="w-full flex items-center p-3 hover:bg-[#f7f8f9] rounded-xl transition-all border border-transparent hover:border-[#e3e3e3] active:bg-[#f2f2f2] text-left">
            <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold mr-3 shrink-0">MK</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-[#1f1f1f] truncate">Mourad Kasdi</p>
              <p class="text-xs text-[#5f6368] truncate">transporteur@fret-dz.com (Transporteur)</p>
            </div>
          </button>

          <!-- 3. Farid -->
          <button onclick="selectAccount('farid.commercial@netlog.dz', 'Farid Mellah')" class="w-full flex items-center p-3 hover:bg-[#f7f8f9] rounded-xl transition-all border border-transparent hover:border-[#e3e3e3] active:bg-[#f2f2f2] text-left">
            <div class="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-bold mr-3 shrink-0">FM</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-[#1f1f1f] truncate">Farid Mellah</p>
              <p class="text-xs text-[#5f6368] truncate">farid.commercial@netlog.dz (Apporteur)</p>
            </div>
          </button>

          <!-- 4. New Custom Account -->
          <div class="p-4 border border-dashed border-[#e3e3e3] rounded-2xl space-y-2 mt-4 bg-slate-55 bg-slate-50">
            <p class="text-xs text-[#1f1f1f] font-bold">Simuler un compte Google spécifique :</p>
            <input type="text" id="custom-name" placeholder="Nom Complet (Ex: Amine Hamidi)" class="w-full p-2.5 text-xs border border-[#ced4da] rounded-xl bg-white outline-none focus:border-[#1D9E75]">
            <input type="email" id="custom-email" placeholder="Email Google (Ex: amine@gmail.com)" class="w-full p-2.5 text-xs border border-[#ced4da] rounded-xl bg-white outline-none mt-1 focus:border-[#1D9E75]">
            <button onclick="selectCustom()" class="w-full mt-2 py-2 bg-[#1D9E75] hover:bg-[#085041] text-white rounded-xl text-xs font-bold transition-all cursor-pointer">
              S'authentifier avec ce compte personnalisé
            </button>
          </div>
        </div>

        <div class="text-[11px] text-[#5f6368] text-center pt-2 leading-tight">
          Pour brancher vos variables de production Google: ajoutez <span class="font-semibold text-slate-800">GOOGLE_CLIENT_ID</span> et <span class="font-semibold text-slate-800">GOOGLE_CLIENT_SECRET</span> dans AI Studio.
        </div>
      </div>

      <script>
        function selectAccount(email, name) {
          const params = new URLSearchParams({ email, name, isDemo: 'true' });
          window.location.href = '/auth/google/callback?' + params.toString();
        }
        function selectCustom() {
          const name = document.getElementById('custom-name').value.trim();
          const email = document.getElementById('custom-email').value.trim();
          if (!name || !email) {
            alert('Veuillez renseigner un nom et un email valides pour tester la simulation Google.');
            return;
          }
          selectAccount(email, name);
        }
      </script>
    </body>
    </html>
  `);
});

// Serve the callback endpoint which executes postMessage to close the popup securely
app.get(["/auth/google/callback", "/auth/google/callback/"], async (req, res) => {
  const { code, isDemo, email, name } = req.query;

  let resolvedEmail = "";
  let resolvedName = "";

  if (isDemo === "true") {
    resolvedEmail = String(email || "invite-google@netlog.dz");
    resolvedName = String(name || "Utilisateur Google");
  } else if (code) {
    try {
      const redirectUri = getGoogleRedirectUri(req);
      
      // Exchange authorization code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: String(code),
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        }).toString()
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Google Token Exchange Code failed: ${tokenResponse.status} ${errorText}`);
      }

      const tokenData: any = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Query user info using the Access Token
      const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });

      if (!userinfoResponse.ok) {
        throw new Error(`Failed to retrieve Google userinfo: ${userinfoResponse.status}`);
      }

      const userinfoData: any = await userinfoResponse.json();
      resolvedEmail = userinfoData.email || "";
      resolvedName = userinfoData.name || userinfoData.email || "Utilisateur Google";
    } catch (err: any) {
      console.error("Error during Google OAuth flow:", err);
      return res.status(500).send(`
        <html>
          <body class="bg-[#f0f4f9] min-h-screen flex flex-col items-center justify-center p-6 text-center font-sans">
            <div class="bg-white rounded-3xl p-8 max-w-md w-full border border-red-100 shadow-lg space-y-4">
              <h2 class="text-red-650 font-black text-lg">Erreur de Connexion Google</h2>
              <p class="text-xs text-slate-500 font-medium leading-relaxed">${err.message || err}</p>
              <button onclick="window.close()" class="mt-4 px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all">Fermer la fenêtre</button>
            </div>
          </body>
        </html>
      `);
    }
  } else {
    return res.status(400).send("Paramètres d'authentification Google manquants.");
  }

  // Construct message success HTML that alerts the client side
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Identification Google réussie</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-slate-50 min-h-screen flex items-center justify-center font-sans">
        <div class="text-center space-y-3 p-8">
          <div class="inline-flex w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 items-center justify-center text-xl font-bold mb-2">✓</div>
          <h2 class="text-base font-black text-slate-850">Authentification Google validée</h2>
          <p class="text-xs text-slate-500 font-mono">${resolvedEmail}</p>
          <p class="text-[11px] text-slate-400">Cette fenêtre va se fermer automatiquement...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'GOOGLE_AUTH_SUCCESS',
              email: "${encodeURIComponent(resolvedEmail)}",
              name: "${encodeURIComponent(resolvedName)}"
            }, '*');
            setTimeout(function() {
              window.close();
            }, 800);
          } else {
            window.location.href = '/';
          }
        </script>
      </body>
    </html>
  `);
});

// Healthcheck
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// GET the current synced state
app.get("/api/sync", (req, res) => {
  res.json(globalState);
});

// POST to update the synced state
app.post("/api/sync", (req, res) => {
  const { users, moyens, offres, propositions, factures, devis } = req.body;
  
  if (users) globalState.users = users;
  if (moyens) globalState.moyens = moyens;
  if (offres) globalState.offres = offres;
  if (propositions) globalState.propositions = propositions;
  if (factures) globalState.factures = factures;
  if (devis) globalState.devis = devis;
  
  globalState.lastUpdated = Date.now();
  
  res.json({ success: true, lastUpdated: globalState.lastUpdated });
});

// Front-end Server Mounting
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mounting Vite middleware in development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Development mode: Vite middleware mounted.");
  } else {
    // Serves static production bundle
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production mode: Static files served from dist/.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express Sync Server successfully running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical: Failed to launch Express Sync Server", err);
});
