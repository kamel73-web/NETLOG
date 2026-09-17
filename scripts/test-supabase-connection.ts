import { createClient } from '@supabase/supabase-js';

// Le script tourne via tsx, en dehors de Vite.
// Les variables sont fournies par l'environnement Replit.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Variables manquantes. Vérifie les Secrets Replit VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('→ Connexion à:', SUPABASE_URL);

  const { data, error, count } = await supabase
    .from('wilayas')
    .select('*', { count: 'exact' })
    .limit(5);

  if (error) {
    console.error('❌ Échec de la requête:', error.message);
    console.error('   Code:', error.code, '| Détails:', error.details);
    process.exit(1);
  }

  console.log('✅ Connexion réussie.');
  console.log(`   Nombre de lignes dans "wilayas": ${count}`);
  console.log('   Échantillon:', data);

  if (count === 0) {
    console.log('ℹ️  Table vide — normal, les 58 wilayas n\'ont pas encore été insérées.');
  }
}

main();
