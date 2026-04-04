# Supabase RLS Policies (INVOORENT)

Ce projet active Row Level Security (RLS) sur:

- `invoo_vehicules`
- `invoo_clients`
- `invoo_reservations`
- `invoo_maintenances`

## Ce qui est applique

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` sur les 4 tables.
- Suppression de l'ancienne policy globale `anon all` si elle existe.
- Creation de policies explicites par action:
  - `SELECT`
  - `INSERT`
  - `UPDATE`
  - `DELETE`
  pour le role `anon`.

## Pourquoi c'est mieux

- Plus lisible et maintenable qu'une policy unique `FOR ALL`.
- Plus simple a auditer.
- Base propre pour evoluer vers une securite par utilisateur.

## Important (usage actuel)

Les policies actuelles autorisent `(true)` pour `anon` (usage personnel / mono-tenant).
Ce n'est pas une isolation multi-utilisateur.

## Evolution recommandee (multi-utilisateur)

1. Ajouter une colonne `owner_id uuid` dans chaque table.
2. Ecrire l'`owner_id` a l'insert (`auth.uid()` cote API/RPC).
3. Remplacer les conditions `(true)` par:

- `USING (auth.uid() = owner_id)`
- `WITH CHECK (auth.uid() = owner_id)`

4. Interdire les `DELETE` physiques si vous utilisez deja un soft-delete (`deleted_at`).

## Rappel securite

- Utiliser uniquement la cle `anon` dans le frontend.
- Ne jamais exposer `service_role` dans l'application cliente.
- Les enregistrements sont synchronises en clair dans la colonne `data` (`jsonb`): Supabase (et tout acces admin au projet) peut lire les donnees clients, reservations, vehicules et maintenances.
- Ce mode est acceptable pour un usage personnel sur un projet prive; pour un niveau de confidentialite superieur, chiffrer les payloads avant envoi.
