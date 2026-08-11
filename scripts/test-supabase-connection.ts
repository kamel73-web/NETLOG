import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// Ce script tourne via tsx, en dehors du contexte Vite : import.meta.env
// n'existe pas ici, il faut lire process.env chargé par dotenv depuis .env.local.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Variables manquantes. Vérifie VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local');
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
