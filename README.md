# phonescore-legal

Site public de **PhoneScore**, servi par Cloudflare Pages sur
**https://phonescore.app** (domaine personnalisé, voir `CNAME`).

Ce dépôt est la **source de vérité** du site. L'application mobile vit dans un
dépôt séparé (`phonescore54`), qui contient un dossier `docs/` avec d'anciennes
copies de `cgu.html` et `confidentialite.html` — **ne pas s'y fier**, elles
dérivent.

## Pages

Les fichiers gardent leur extension, **les adresses non** : Cloudflare Pages
sert `/cgu` et redirige `/cgu.html` en 308. Écrire les liens internes en
absolu et sans extension (`href="/cgu"`) — un lien relatif dépend de la forme
exacte de l'adresse courante, un lien absolu non.

| Fichier | URL | Rôle |
|---|---|---|
| `index.html` | `/` | Présentation du produit et lien de téléchargement |
| `assistance.html` | `/assistance` | FAQ, suppression de compte, contact — **c'est l'URL d'assistance Apple** |
| `rapport.html` | `/rapport` | Ce que chaque ligne du rapport signifie |
| `revendeurs.html` | `/revendeurs` | Badge boutique « Certifiée » |
| `cgu.html` | `/cgu` | Conditions générales d'utilisation |
| `confidentialite.html` | `/confidentialite` | Politique de confidentialité |
| `profil.html` | `/profil` | Compte : solde, accès revendeur, parrainage — `noindex` |
| `recharger.html` | `/recharger` | Recharge de pièces par mobile money — `noindex` |
| `reinitialiser.html` | `/reinitialiser` | Réinitialisation de mot de passe (lien Supabase) — `noindex` |
| `payment-result.html` | `/payment-result` | Retour de paiement GeniusPay — `noindex` |
| `404.html` | — | Page d'erreur, servie automatiquement par Cloudflare Pages |

## Contraintes à respecter

**L'URL d'assistance déclarée à Apple doit servir de l'assistance.** La
guideline 1.5 l'exige, et une soumission a déjà été rejetée le 4 août 2026 sur
ce motif, l'ancienne URL `blmbob.github.io` renvoyant une erreur. La FAQ a
depuis quitté la racine pour `assistance.html` : l'URL à déclarer est
`https://phonescore.app/assistance`. Tant qu'App Store Connect n'a pas été
mis à jour (voir « À faire »), **ne pas soumettre de nouvelle version** — la
racine ne contient plus que le renvoi vers la page dédiée.

**La description de la suppression de compte doit rester en libre-service.**
La guideline 5.1.1(v) impose une suppression depuis l'application ; décrire une
suppression « sur demande par e-mail » est un motif de rejet. Le texte doit
rester cohérent avec `confidentialite.html` et avec le comportement réel de
l'app (écran Profil → « Supprimer mon compte »).

**L'adresse de contact doit rester en service.** `support@phonescore.app` est
l'adresse déclarée dans les CGU et dans la politique de confidentialité, où
elle est le canal d'exercice des droits prévus par la loi ivoirienne
n° 2013-450 — délai de réponse annoncé : 30 jours. Elle est aussi le seul
contact de la page d'assistance vue par Apple. Elle apparaît à dix endroits,
dont le schéma `Organization` de l'accueil et une chaîne de `js/profil.js` :
la changer impose de relancer `versionner-assets.py`.

**Les moyens de paiement décrits doivent rester exacts.** Sur iOS, les pièces
sont vendues par achat intégré App Store. Décrire le mobile money comme unique
canal reproduirait le rejet 3.1.1 du 4 août 2026.

## Ressources

- `og-image.png` — 1024×1024, opaque, reprise de l'icône de l'app. Utilisée pour
  les aperçus de liens (WhatsApp, réseaux sociaux).
- `favicon.png` — 256×256.
- `robots.txt`, `sitemap.xml` — indexation. Les pages `noindex` sont laissées
  au crawl : les interdire dans `robots.txt` annulerait leur balise.
- `css/`, `js/` — un fichier par page. Aucun style ni script en ligne, la CSP
  les refuse.
- `vendor/supabase-2.112.3.js` — client Supabase servi par le site, en version
  fixe. Empreinte dans `vendor/SHA256SUMS.txt`.
- `_headers` — en-têtes de sécurité, lus par Cloudflare Pages. C'est le seul
  endroit où `frame-ancestors` s'applique vraiment ; la balise `<meta>` CSP de
  chaque page reprend le reste. **Modifier l'un, c'est modifier l'autre.**
- `_redirects` — redirections serveur, lues par Cloudflare Pages. Y mettre
  toute adresse retirée qui a pu être partagée, plutôt qu'une page qui
  redirige elle-même. Contient `/verifier`, ancienne page de vérification.
- `outils/versionner-assets.py` — colle une empreinte de contenu aux adresses
  de `js/` et `css/`.

## Déploiement

Pousser sur `main` suffit, Cloudflare Pages reconstruit.

**Si le poussé touche un fichier de `js/` ou `css/`, lancer d'abord :**

```bash
python outils/versionner-assets.py
```

Cloudflare impose 4 heures de cache navigateur aux ressources statiques et
refuse qu'on raccourcisse ce délai ; le HTML, lui, est revalidé à chaque
visite. Sans nouvelle empreinte, un visiteur déjà venu reçoit du HTML neuf
avec du script périmé, et la page casse sans la moindre erreur. Le script est
idempotent : le lancer pour rien ne change rien.

## État

L'app est **publiée** depuis le 13 août 2026 :
<https://apps.apple.com/app/id6795897093> (version 1.0, gratuite).
Le lien de téléchargement est en place sur l'accueil.

Le site a quitté GitHub Pages pour Cloudflare Pages le 20 août 2026, pour
pouvoir poser de vrais en-têtes HTTP.

## À faire

- **Créer la boîte `support@phonescore.app` AVANT de déployer.** Le site ne
  cite plus `phonescore.support@gmail.com` nulle part : déployer avant que la
  boîte reçoive couperait le support, les réclamations et les demandes RGPD
  d'un coup. Le DNS étant déjà chez Cloudflare, Email Routing fait suivre vers
  une boîte existante gratuitement, sans serveur à tenir.
- **App Store Connect : remplacer l'URL d'assistance par
  `https://phonescore.app/assistance`**, avant toute nouvelle soumission.
  Reste ouvert depuis le déplacement de la FAQ hors de la racine (`da7dc7e`) ;
  l'adresse a perdu son `.html` depuis, c'est la forme ci-dessus qu'il faut
  déclarer.
