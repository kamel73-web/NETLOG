import sys

PATH = "src/types.ts"

OLD = '''  transporteurParentId?: string;
  disponibiliteChauffeur?: "Disponible" | "Indisponible" | "En route";
  positionChauffeur?: string;
}'''

NEW = '''  transporteurParentId?: string;
  disponibiliteChauffeur?: "Disponible" | "Indisponible" | "En route";
  positionChauffeur?: string;
  // Champs métier variables selon le rôle (secteur, type d'engins,
  // wilaya d'activité spécifique...), stockés en jsonb côté Supabase
  // (profiles.metadata) plutôt qu'en colonnes dédiées pour chaque rôle.
  metadata?: Record<string, any>;
}'''

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

count = content.count(OLD)
if count == 0:
    print("❌ Texte exact introuvable — RIEN N'A ÉTÉ MODIFIÉ.")
    print("   Envoyez-moi : grep -n 'interface UserProfile' -A 40 src/types.ts")
    sys.exit(1)
elif count > 1:
    print(f"⚠️  Le texte apparaît {count} fois — remplacement annulé par sécurité.")
    sys.exit(1)
else:
    content = content.replace(OLD, NEW)
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("✅ Champ metadata ajouté avec succès à UserProfile.")
