# Mettre L’Art des Associations en ligne

À faire **une seule fois**, depuis un ordinateur (environ 20 minutes). Aucune ligne de code à écrire : uniquement des comptes à créer et des fichiers à glisser-déposer. Ensuite, toutes les modifications se font depuis l’administration, y compris depuis l’iPhone.

---

## Étape 1 — Créer votre compte GitHub et y déposer le projet

GitHub conserve votre projet, vos palettes et l’historique de toutes vos versions.

1. Créez un compte gratuit sur **github.com** (« Sign up »). Activez la double authentification lorsque GitHub vous le propose (Settings → Password and authentication) : c’est elle qui protège votre catalogue.
2. En haut à droite, cliquez sur **＋ → New repository**.
   - *Repository name* : `art-des-associations`
   - Cochez **Private** (votre code reste privé ; le catalogue sera public grâce à Cloudflare).
   - Cochez **Add a README file**, puis **Create repository**.
3. Dans le dépôt créé, cliquez sur **Add file → Upload files**.
4. Décompressez le fichier ZIP fourni sur votre Mac. Ouvrez le dossier `art-des-associations`, sélectionnez **tout son contenu** (fichiers et dossiers `admin`, `assets`, `data`, `icons`, `media`, etc.) et glissez-le dans la page GitHub.
   > Glissez le *contenu* du dossier, pas le dossier lui-même : `index.html` doit se trouver à la racine du dépôt.
   > Sur Mac, les fichiers commençant par un point sont masqués : ce n’est pas grave, le fichier `media/.gitkeep` n’est pas indispensable.
5. En bas, cliquez sur **Commit changes**. Vérifiez que `index.html`, `_headers` et le dossier `data` apparaissent bien à la racine.

## Étape 2 — Publier l’application avec Cloudflare Pages

1. Créez un compte gratuit sur **dash.cloudflare.com/sign-up**.
2. Dans le menu de gauche : **Workers & Pages** (selon l’interface : « Compute » → « Workers & Pages »), puis **Create application**, onglet ou lien **Pages**, puis **Connect to Git** (« Import an existing Git repository »).
3. Autorisez Cloudflare à accéder à GitHub ; vous pouvez limiter l’accès au seul dépôt `art-des-associations`.
4. Choisissez le dépôt, puis **Begin setup** :
   - *Project name* : `art-des-associations` (il formera l’adresse `art-des-associations.pages.dev` ; si ce nom est pris, Cloudflare en propose une variante)
   - *Production branch* : `main`
   - *Framework preset* : **None**
   - *Build command* : **laisser vide**
   - *Build output directory* : **laisser vide** (ou `/`)
5. Cliquez sur **Save and Deploy**. Après environ une minute, Cloudflare affiche l’adresse de votre application, du type **https://art-des-associations.pages.dev**.

### Vérifier la mise en ligne (obligatoire)

Ouvrez l’adresse et vérifiez :

- [ ] la page d’accueil s’affiche avec la bannière et les 8 familles ;
- [ ] la galerie indique **248 / 248 palettes** ;
- [ ] une palette s’ouvre avec sa simulation de site vitrine ;
- [ ] le bouton **Installer l’app** ouvre la fenêtre d’installation ;
- [ ] `…/admin/` affiche l’écran de connexion de l’administration.

Tant que ces points ne sont pas vérifiés, l’application n’est pas considérée comme publiée.

## Étape 3 — Créer votre clé d’accès à l’administration

L’administration écrit dans votre dépôt GitHub. Elle a besoin d’une clé d’accès limitée à ce seul dépôt.

1. Sur github.com, cliquez sur votre photo de profil → **Settings** → tout en bas à gauche **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Remplissez :
   - *Token name* : `Administration Art des Associations`
   - *Expiration* : la durée de votre choix. GitHub propose jusqu’à un an, ou « No expiration ». Une durée d’un an est un bon compromis : notez la date dans votre agenda pour la renouveler.
   - *Repository access* : **Only select repositories** → `art-des-associations`
   - *Permissions* → *Repository permissions* → **Contents : Read and write** (la permission « Metadata : Read-only » s’ajoute automatiquement).
3. Cliquez sur **Generate token**, puis copiez la clé qui commence par `github_pat_…`. GitHub ne l’affichera plus : conservez-la dans votre gestionnaire de mots de passe (Trousseau iCloud, etc.).

> Cette clé est l’équivalent d’un mot de passe. Ne l’envoyez jamais par e-mail et ne la collez jamais dans un fichier du projet. Elle n’est enregistrée que sur les appareils où vous vous connectez à l’administration.

## Étape 4 — Première connexion à l’administration

1. Ouvrez `https://art-des-associations.pages.dev/admin/` (avec votre adresse réelle).
2. *Dépôt GitHub du projet* : `votre-identifiant-github/art-des-associations`
3. *Clé d’accès* : collez la clé `github_pat_…`
4. Cochez « Rester connectée sur cet appareil » sur votre Mac et votre iPhone personnels uniquement.
5. Faites un premier essai : modifiez un texte dans **Apparence**, cliquez sur **Aperçu**, puis **Publier**. Une minute plus tard, la modification apparaît sur le site : l’administration affiche « ✓ Publication en ligne ».

Astuce iPhone : ouvrez `/admin/` dans Safari → Partager → **Sur l’écran d’accueil** pour avoir une icône d’accès direct à votre administration.

## Étape 5 (facultative) — Votre propre nom de domaine

Exemples : `couleurs.votre-agence.fr` ou `artdesassociations.fr`.

- **Sous-domaine** (ex. `couleurs.votre-agence.fr`), le plus simple si vous avez déjà un site :
  1. Cloudflare → votre projet Pages → **Custom domains** → **Set up a custom domain** → saisissez `couleurs.votre-agence.fr`.
  2. Chez votre registraire (OVH, Gandi, IONOS…), ajoutez l’enregistrement DNS indiqué par Cloudflare : un **CNAME** `couleurs` → `art-des-associations.pages.dev`.
  3. Le certificat HTTPS est créé automatiquement (de quelques minutes à quelques heures).
- **Domaine principal** (ex. `artdesassociations.fr`) : Cloudflare exige que le domaine soit géré par Cloudflare. Ajoutez-le à Cloudflare (« Add a domain »), puis remplacez chez votre registraire les serveurs DNS par ceux que Cloudflare vous indique. Vérifiez au préalable que vos enregistrements e-mail (MX) ont bien été repris.

L’adresse `….pages.dev` continue de fonctionner. Après le changement de domaine, les clients devront réinstaller l’application depuis la nouvelle adresse, et vous devrez vous reconnecter à l’administration à cette adresse. Le plus simple est donc de choisir le domaine définitif **avant** de diffuser le lien.

## Modifier le code plus tard (rare)

Les palettes, images et textes se modifient dans l’administration. Pour une évolution du code (nouvelle fonctionnalité, nouvelle mise en page), un·e développeur·se modifie les fichiers dans GitHub. Cloudflare remet le site en ligne automatiquement. Après une modification du code, augmentez le numéro `VERSION` en haut du fichier `sw.js` : les applications installées proposeront alors « Une nouvelle version est disponible ».

## En cas de souci

| Symptôme | Solution |
|---|---|
| La page est blanche ou affiche « 404 » | `index.html` n’est pas à la racine du dépôt : vous avez glissé le dossier au lieu de son contenu. |
| L’administration indique « Clé refusée ou expirée » | Créez une nouvelle clé (étape 3), puis reconnectez-vous. |
| « Accès refusé : la clé doit avoir l’autorisation Contents » | Modifiez la clé sur GitHub : *Contents : Read and write* sur le bon dépôt. |
| Une publication n’apparaît pas | Cloudflare → projet → *Deployments* : la dernière mise en ligne doit être « Success ». Rechargez ensuite la page. |
| Le bouton « Installer » n’apparaît pas | Normal sur iPhone et sous Safari : suivez les instructions affichées dans la fenêtre d’installation. |
