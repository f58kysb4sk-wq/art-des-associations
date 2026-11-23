# L’Art des Associations — application

Catalogue interactif de 248 palettes de couleurs, transformé en application web installable (PWA) avec un espace d’administration privé.

## Ce que contient ce dossier

| Élément | Rôle |
|---|---|
| `index.html`, `assets/` | L’application publique (design d’origine conservé : familles, galerie, filtres, recherche, simulations de sites vitrines, favoris). |
| `data/catalogue.json` | **Toutes vos données** : les 248 palettes, les collections, les intensités, les textes du site. C’est ce fichier que l’administration modifie. |
| `media/` | Les images importées depuis l’administration (optimisées automatiquement). |
| `admin/` | L’espace d’administration privé (adresse : `/admin/`). |
| `manifest.webmanifest`, `sw.js`, `icons/` | Ce qui rend l’application installable et utilisable hors connexion. |
| `_headers`, `robots.txt` | Réglages de sécurité et de cache pour l’hébergeur ; l’administration n’est pas référencée par les moteurs de recherche. |
| `GUIDE-MISE-EN-LIGNE.md` | Mettre l’application en ligne (une seule fois, environ 20 minutes). |
| `GUIDE-ADMINISTRATION.md` | Utiliser l’administration au quotidien, installer l’application, sauvegarder, restaurer. |

## L’architecture retenue, en bref

```
 Vous (Mac / iPhone)                     Vos clients
   │  /admin/ + clé d’accès                 │  lien https://…
   ▼                                        ▼
 GitHub (dépôt privé)  ── publication ──►  Cloudflare Pages  ──►  Application installable
 code + palettes + images                  hébergement HTTPS        (iPhone, iPad, Mac, Windows, Android)
 historique de toutes les versions        mise en ligne en ~1 min
```

- **GitHub** conserve le code, le fichier des palettes et les images. Chaque publication y crée une version datée : c’est votre système de sauvegarde et de restauration.
- **Cloudflare Pages** héberge l’application (HTTPS, réseau mondial) et la remet en ligne automatiquement après chaque publication.
- **L’administration** est une page de l’application qui, une fois votre clé d’accès saisie, écrit directement dans votre dépôt GitHub. Aucun serveur ni base de données supplémentaire à maintenir : rien ne peut « tomber en panne » ou être mis en veille.

Pourquoi ce choix plutôt que Netlify, Vercel ou Supabase :

- **Netlify** (offre gratuite) facture chaque mise en ligne 15 crédits sur 300 par mois, soit environ 20 publications par mois avant blocage. Trop juste pour un catalogue que vous modifiez souvent.
- **Vercel** (offre gratuite « Hobby ») est réservé à un usage personnel et non commercial ; votre catalogue est un outil professionnel.
- **Cloudflare Pages** gratuit : 500 mises en ligne par mois, bande passante et visites illimitées, usage commercial autorisé, nom de domaine personnalisé inclus.
- **Supabase** aurait ajouté une base de données et un compte de plus. Pour quelques centaines ou milliers de palettes (moins de 1 Mo de données), un fichier versionné dans GitHub est plus simple, gratuit, sans mise en veille, et entièrement exportable.

## Coûts

| Poste | Coût |
|---|---|
| GitHub (dépôt privé, historique illimité) | 0 € |
| Cloudflare Pages (hébergement, HTTPS, 500 publications/mois) | 0 € |
| Nom de domaine personnalisé (facultatif) | environ 10 à 15 € par an pour un .fr ou .com, selon le registraire |
| **Total** | **0 €**, ou le prix du nom de domaine |

Si un jour vous dépassez 500 publications par mois, l’offre Pro de Cloudflare Pages coûte 25 $ par mois (ou 240 $ par an) pour 5 000 mises en ligne par mois. Pour un catalogue comme le vôtre, il est très improbable d’en avoir besoin.

## Propriété et indépendance

Tout est à votre nom : le compte GitHub, le compte Cloudflare, le nom de domaine. Le code est du HTML, du CSS et du JavaScript standards, sans dépendance à installer ni étape de compilation : il peut être hébergé tel quel chez n’importe quel hébergeur (OVH, o2switch, Netlify…). Vos données sont un fichier JSON lisible, exportable à tout moment depuis l’administration (Publication → Sauvegarde).

## Pour un·e développeur·se

- Aucune étape de compilation. Racine du site = racine du dépôt.
- `assets/core.js` contient les règles de classement (familles et intensités), partagées par le site et l’administration. Elles reprennent à l’identique celles du fichier d’origine.
- Les adresses sont partageables : `#/palette/68`, `#/collection/roses`, `#/favoris`, `#installer`.
- Après une modification du code (pas des palettes), changez `VERSION` dans `sw.js` pour que les applications installées proposent la mise à jour.
- Cache : le service worker charge les pages, le code et les données depuis le réseau en priorité (avec repli hors connexion), et les images ou polices depuis le cache en priorité.
