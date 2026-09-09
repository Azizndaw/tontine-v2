# 🚀 Guide de Déploiement Vercel & Base de Données Cloud

Ce guide vous explique comment déployer l'application **Tontine** sur **Vercel** avec une base de données Cloud gratuite (Supabase) pour livrer une solution 100% en ligne et permanente à votre client.

---

## Étape 1 : Créer la base de données Cloud (Supabase - 2 minutes)

1. Rendez-vous sur **[supabase.com](https://supabase.com)** et créez un compte gratuit.
2. Cliquez sur **New Project**, donnez-lui un nom (ex: `tontine-db`) et choisissez un mot de passe.
3. Dans le menu de gauche, rendez-vous dans **SQL Editor**.
4. Cliquez sur **New query**, collez le code suivant (issu du fichier `schema.sql`) puis cliquez sur **Run** :

```sql
CREATE TABLE IF NOT EXISTS tontine_store (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE tontine_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access" ON tontine_store 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
```

5. Dans le menu **Project Settings** (icône engrenage) > **API** :
   - Copiez la **Project URL** (ex: `https://xyzcompany.supabase.co`)
   - Copiez la clé **anon / public** (ex: `eyJhbGciOi...`)

---

## Étape 2 : Déployer sur Vercel (1 minute)

1. Rendez-vous sur **[vercel.com](https://vercel.com)** et connectez-vous.
2. Cliquez sur **Add New Project** et importez le dossier du projet `tontine-v2` (ou connectez votre dépôt GitHub).
3. Dans la section **Environment Variables**, ajoutez les 2 variables d'environnement suivantes :
   - **`SUPABASE_URL`** = *(collez votre Project URL de l'étape 1)*
   - **`SUPABASE_KEY`** = *(collez votre clé anon/public de l'étape 1)*
4. Cliquez sur **Deploy**.

---

## 🎉 C'est terminé !

Votre application est désormais en ligne avec une URL sécurisée générée par Vercel (ex: `https://tontine-v2.vercel.app`).

### Avantages pour votre client :
- ✅ **Accessible partout** : Fonctionne sur PC, Mac, Android et iPhone.
- ✅ **Données persistantes** : Tout est automatiquement sauvegardé dans la base Cloud Supabase.
- ✅ **Zéro maintenance** : Aucun serveur local à laisser allumé sur votre ordinateur.
