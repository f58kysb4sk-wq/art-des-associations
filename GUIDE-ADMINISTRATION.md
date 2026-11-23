# Guide d’utilisation — administration et application

Adresse de l’administration : **votre-adresse/admin/** (par exemple `https://art-des-associations.pages.dev/admin/`). Elle fonctionne sur Mac, iPhone, iPad et sur tout ordinateur.

## 1. Le principe en 30 secondes

1. **Vous modifiez** : vos changements vont dans un **brouillon**, enregistré automatiquement sur l’appareil. Les visiteurs ne voient rien.
2. **Vous vérifiez** : le bouton **Aperçu ↗** ouvre le vrai catalogue avec votre brouillon (bandeau « Aperçu du brouillon »).
3. **Vous publiez** : **Publier** met le catalogue à jour pour tout le monde en une minute environ. L’administration confirme : « ✓ Publication en ligne ».

Chaque publication est conservée dans l’**historique** : vous pouvez toujours revenir en arrière.

En haut de l’écran, un point vert signifie « Tout est publié ». Un point orange indique le nombre de modifications en attente.

## 2. Palettes

**Ajouter** : Palettes → **＋ Ajouter une palette**.
- *Nom*, *Description* (facultative, affichée sur la fiche de la palette).
- *Couleurs* : touchez le carré pour la pipette, ou tapez le code HEX (`#D31738`). Les cinq premières couleurs ont un rôle dans la simulation : **Fond, Accent, Nuance, Secondaire, Contraste**. Vous pouvez en ajouter jusqu’à dix (« ＋ Ajouter une couleur ») et changer leur ordre avec ↑ ↓.
- *Familles* : avec « Classement automatique » coché, les familles se déduisent des couleurs (même règle que votre catalogue d’origine : un beige ou un taupe n’est pas classé « orange »). Cochez en plus les collections thématiques de votre choix. Décochez le classement automatique pour tout choisir à la main.
- *Intensité* : même principe (pastel, nude, vif, flashy, profond).
- *Simulation de site vitrine* : choisissez l’une des six mises en page, et, si vous le souhaitez, un nom de marque et un grand titre propres à cette palette.
- *Mises en situation* : ajoutez des photos (vitrine, carte de visite, intérieur…) qui s’affichent sous la simulation.
- *Position dans le catalogue* : 1 = en tête.
- **Enregistrer** ajoute la palette au brouillon.

**Modifier** : bouton **Modifier** sur la ligne de la palette. Utilisez la recherche (nom, numéro ou code HEX) et le filtre (publiées, masquées, par famille).

**Masquer / Publier** : retire temporairement une palette du catalogue sans la perdre. Une copie créée avec « Dupliquer » est masquée par défaut, le temps de la retoucher.

**Dupliquer** : crée une copie (masquée) juste après l’original, pratique pour créer une variante.

**Réorganiser** : flèches ↑ ↓ sur chaque ligne, ou le champ *Position* dans la fiche. L’ordre de la liste est l’ordre du catalogue.

**Supprimer** : une confirmation est demandée. Après publication, la palette reste récupérable grâce à l’historique.

Passer de 248 à 500 ou 1 000 palettes ne pose aucun problème : l’application reste fluide et la numérotation (« Palette 249 / 249 ») suit automatiquement.

## 3. Collections

- **＋ Nouvelle collection** : donnez un nom (ex. « Mariage », « Restaurants », « Bien-être »).
  - *Contenu automatique* : la collection se remplit d’après les couleurs (ex. toutes les palettes contenant des teintes vertes).
  - *Thématique* : vous choisissez les palettes une à une (bouton **Choisir les palettes**, avec recherche).
- *Sous-catégorie de* : rattache la collection à une collection principale (ex. « Pastel rosé » dans « Roses »). Ses palettes apparaissent alors aussi dans la collection principale, avec un bouton d’accès rapide.
- *Couleurs de la vignette* : les trois bandes de couleur affichées sur l’accueil.
- *Visible sur la page d’accueil* : décochez pour masquer une collection sans la supprimer.
- Flèches ↑ ↓ : ordre d’affichage sur l’accueil.
- **Supprimer** une collection ne supprime aucune palette.

**Intensités** (même écran, plus bas) : renommez les filtres, changez leur ordre, créez-en de nouvelles (ex. « Terreux ») que vous attribuez ensuite à la main dans les palettes.

## 4. Images

Médias → **Importer depuis cet appareil** (ou glisser-déposer sur Mac). Sur iPhone, vous pouvez choisir dans la photothèque ou prendre une photo.

Chaque image est automatiquement **redimensionnée (1 800 px maximum), compressée au format WebP et débarrassée de ses métadonnées** (dont la localisation GPS) avant l’envoi. Une photo de plusieurs mégaoctets ne pèse généralement plus que quelques centaines de kilooctets.

Utilisez ensuite vos images :
- dans une palette → *Mises en situation* → **＋ Ajouter une image** (avec légende et description pour l’accessibilité) ;
- dans **Apparence** → *Logo* ou *Photographie de bannière*.

Une image utilisée ne peut pas être supprimée : retirez-la d’abord de la palette ou de l’apparence, puis publiez.

> Les nouvelles images s’affichent dans l’administration immédiatement. Dans l’aperçu et sur le site, elles apparaissent après la publication suivante.

## 5. Apparence et textes

Tous les textes de l’accueil, de la galerie, des fiches et du pied de page, ainsi que le logo, la bannière, les coordonnées de contact et les couleurs de l’interface.

Petites règles de mise en forme :
- `*prend vie.*` → *prend vie.* (italique)
- un retour à la ligne crée un saut de ligne ;
- `{total}` affiche automatiquement le nombre de palettes publiées, `{colors}` le nombre de couleurs.

**Contact** : dès qu’un e-mail, un téléphone, un site ou un compte Instagram est renseigné, un bloc « Contact » apparaît en bas de l’accueil.

**Couleurs de l’interface** : vérifiez toujours la lisibilité dans l’aperçu. « Rétablir les couleurs d’origine » annule vos essais.

Pour des changements plus profonds (nouvelle section, nouvelle mise en page de simulation), le code source reste modifiable : voir le README.

## 6. Publication, historique, restauration

Écran **Publication** :
- **Modifications en attente** : la liste précise de ce qui va changer (palettes ajoutées, modifiées, supprimées, textes…).
- **Note de version** (facultative) : par exemple « Collection Mariage ». Elle apparaît dans l’historique.
- **Prévisualiser**, puis **Publier maintenant**.
- **Enregistrer le brouillon en ligne** : pour commencer sur le Mac et terminer sur l’iPhone sans rien publier. Sur l’autre appareil, l’administration propose « Le reprendre ».
- **Annuler toutes les modifications** : remet le brouillon dans l’état du site en ligne.

**Historique des versions** : chaque publication y figure avec sa date. **Restaurer** recharge une ancienne version dans le brouillon ; vérifiez-la avec l’aperçu, puis publiez. Corriger une erreur prend donc moins d’une minute.

Si vous publiez depuis deux appareils en même temps, l’administration refuse d’écraser la version la plus récente et vous demande de recharger la page. Votre brouillon n’est pas perdu : il vous est proposé à la reconnexion.

> Le brouillon enregistré en ligne est stocké dans le dépôt (`data/brouillon.json`). Il devient consultable par une personne qui connaîtrait l’adresse exacte de ce fichier après la publication suivante. N’y laissez rien de confidentiel.

## 7. Sauvegarde et récupération

Trois niveaux de sécurité :

1. **Automatique** : GitHub conserve toutes les versions publiées et toutes les images (historique illimité).
2. **Sauvegarde du catalogue** : Publication → *Télécharger une sauvegarde (.json)*. Un fichier contenant toutes les palettes, collections et textes. Conseil : une fois par mois, enregistrez-le dans iCloud Drive.
3. **Archive complète** : Publication → *Télécharger tout le projet (.zip)*. Code source, données et images, prêts à être réhébergés ailleurs.

**Restaurer une sauvegarde .json** : Publication → *Importer une sauvegarde…* → vérifiez l’aperçu → Publier.

**Migrer ailleurs** : l’archive .zip contient un site statique standard qui peut être déposé tel quel chez n’importe quel hébergeur.

## 8. Sécurité

- L’administration n’est accessible qu’avec votre clé GitHub, qui n’est jamais publiée ni intégrée au code. Les visiteurs n’ont aucun accès aux fonctions d’administration, et l’adresse `/admin/` n’est pas référencée par les moteurs de recherche.
- Activez la double authentification sur GitHub et sur Cloudflare.
- Sur un ordinateur partagé, décochez « Rester connectée » et utilisez **Se déconnecter**.
- Appareil perdu ou volé : sur github.com → Settings → Developer settings → Fine-grained tokens, supprimez la clé, puis créez-en une nouvelle.
- Pour essayer l’administration sans risque : écran de connexion → **Essayer l’administration en mode local**. Rien n’est publié dans ce mode.

## 9. Installer l’application (pour vous et vos clients)

Le catalogue fonctionne directement dans le navigateur. L’installer ajoute une icône et l’ouvre en plein écran, sans barre d’adresse. Le bouton **Installer l’app** (en haut à droite) affiche automatiquement les bonnes instructions pour l’appareil utilisé.

**iPhone et iPad**
1. Ouvrir le lien dans **Safari**.
2. Toucher **Partager** (carré avec une flèche vers le haut).
3. Choisir **Sur l’écran d’accueil**, puis **Ajouter**.

**Mac**
- Safari (macOS Sonoma ou plus récent) : menu **Fichier → Ajouter au Dock…**. L’application s’ouvre ensuite depuis le Dock, dans sa propre fenêtre.
- Chrome ou Edge : icône d’installation à droite de la barre d’adresse, ou bouton **Installer l’app**.

**Windows** : Chrome ou Edge → bouton **Installer l’app**, ou icône d’installation dans la barre d’adresse. L’application s’ajoute au menu Démarrer.

**Android** : Chrome, Edge ou Samsung Internet → bouton **Installer l’app** (installation en un geste), ou menu ⋮ → *Installer l’application*.

Limites des plateformes : sur iPhone et iPad, l’installation ne peut pas être déclenchée par un bouton ; Apple impose le passage par le menu Partager. Firefox sur ordinateur ne permet pas d’installer d’application web : le catalogue y reste utilisable normalement.

**Mises à jour** : les palettes publiées apparaissent à la prochaine ouverture de l’application, ou automatiquement lorsqu’elle revient au premier plan après quelques minutes. Les palettes déjà consultées restent disponibles hors connexion.

## 10. Partager le catalogue

- **Le lien principal** : `https://votre-adresse/`.
- **Le lien qui ouvre directement les instructions d’installation** : `https://votre-adresse/#installer`. C’est l’idéal à envoyer à un client par e-mail ou SMS.
- **Le lien d’une palette précise** : bouton **Partager ↗** sur la fiche. Sur iPhone, il ouvre le menu de partage (Messages, WhatsApp, e-mail…). Exemple : `https://votre-adresse/#/palette/68`.
- **Le lien d’une collection** : `https://votre-adresse/#/collection/roses`.
- **Les favoris** de chaque client sont enregistrés sur son propre appareil (rubrique ♡). Il peut vous indiquer ses coups de cœur en partageant leurs liens.

Exemple de message à un client :

> Bonjour, voici notre bibliothèque de couleurs pour choisir l’ambiance de votre futur site : https://votre-adresse/#installer
> Enregistrez vos palettes préférées avec ♡, puis envoyez-moi leurs liens avec le bouton « Partager ».
