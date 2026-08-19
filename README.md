# phonescore-legal

Site public de **PhoneScore**, servi par GitHub Pages sur **https://phonescore.app**
(domaine personnalisé, voir `CNAME`).

Ce dépôt est la **source de vérité** du site. L'application mobile vit dans un
dépôt séparé (`phonescore54`), qui contient un dossier `docs/` avec d'anciennes
copies de `cgu.html` et `confidentialite.html` — **ne pas s'y fier**, elles
dérivent.

## Pages

| Fichier | URL | Rôle |
|---|---|---|
| `index.html` | `/` | Présentation du produit **et** page d'assistance (ancre `#assistance`) |
| `cgu.html` | `/cgu.html` | Conditions générales d'utilisation |
| `confidentialite.html` | `/confidentialite.html` | Politique de confidentialité |
| `reinitialiser.html` | `/reinitialiser.html` | Réinitialisation de mot de passe (lien Supabase) — `noindex` |
| `payment-result.html` | `/payment-result.html` | Retour de paiement GeniusPay — `noindex` |
| `404.html` | — | Page d'erreur, servie automatiquement par GitHub Pages |

## Contraintes à respecter

**L'assistance doit rester à la racine.** `https://phonescore.app` est l'URL
d'assistance déclarée dans App Store Connect, et la guideline Apple 1.5 exige
qu'elle serve des informations d'assistance. Une soumission a déjà été rejetée
le 4 août 2026 sur ce motif, l'ancienne URL `blmbob.github.io` renvoyant une
erreur. Ne pas déplacer la FAQ vers une page séparée sans changer l'URL dans
App Store Connect au préalable.

**La description de la suppression de compte doit rester en libre-service.**
La guideline 5.1.1(v) impose une suppression depuis l'application ; décrire une
suppression « sur demande par e-mail » est un motif de rejet. Le texte doit
rester cohérent avec `confidentialite.html` et avec le comportement réel de
l'app (écran Profil → « Supprimer mon compte »).

**Les moyens de paiement décrits doivent rester exacts.** Sur iOS, les pièces
sont vendues par achat intégré App Store. Décrire le mobile money comme unique
canal reproduirait le rejet 3.1.1 du 4 août 2026.

## Ressources

- `og-image.png` — 1024×1024, opaque, reprise de l'icône de l'app. Utilisée pour
  les aperçus de liens (WhatsApp, réseaux sociaux).
- `favicon.png` — 256×256.
- `robots.txt`, `sitemap.xml` — indexation.

## Déploiement

Pousser sur `main` suffit. GitHub Pages reconstruit en une à deux minutes :

```bash
gh api repos/Blmbob/phonescore-legal/pages/builds/latest --jq .status
```

Attendre `built` avant de vérifier l'URL en ligne — sinon on lit l'ancienne
version.

## État

L'app est **publiée** depuis le 13 août 2026 :
<https://apps.apple.com/app/id6795897093> (version 1.0, gratuite).
Le lien de téléchargement est en place sur l'accueil.

## À faire

