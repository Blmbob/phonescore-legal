/* Traduction cote client de l'accueil, meme principe que lib/i18n.ts cote
   app (langue du telephone/navigateur detectee au premier chargement,
   francais garde sauf preference explicite, override persiste). Pas de
   framework : un attribut data-i18n par noeud de texte, applique au chargement
   et rejoue quand l'utilisateur change de langue depuis le menu. */

const LANGUE_CLE = 'phonescore:langue';
const LANGUES_SUPPORTEES = ['fr', 'en'];

const TRADUCTIONS = {
  fr: {
    nav: {
      profil: 'Profil', historique: 'Historique', assistance: 'Assistance',
      rapport: 'Comprendre le rapport', revendeurs: 'Badge boutique',
      cgu: "Conditions générales d'utilisation", confidentialite: 'Politique de confidentialité',
    },
    hero: { lead: "Vérifie avant d'acheter" },
    auth: {
      sousTitreConnexion: 'Connectez-vous pour vérifier un appareil.',
      sousTitreInscription: 'Créez un compte en quelques secondes — puis vérifiez un appareil.',
      apple: 'Continuer avec Apple',
      ou: 'ou',
      emailLabel: 'Adresse e-mail', emailPh: 'vous@exemple.com',
      mdpLabel: 'Mot de passe', mdpPh: '8 caractères minimum',
      mdpConfirmLabel: 'Confirmer le mot de passe', mdpConfirmPh: 'Retapez le même mot de passe',
      connexion: 'Se connecter', inscription: 'Créer un compte',
      basculerVersInscription: 'Créer un nouveau compte', basculerVersConnexion: 'J’ai déjà un compte',
      mdpOublie: 'Mot de passe oublié ?',
      legalPrefixe: 'En créant un compte, vous acceptez les',
      legalCgu: "conditions d'utilisation", legalEt: 'et la', legalConfidentialite: 'politique de confidentialité',
      champsManquants: 'Renseignez votre e-mail et votre mot de passe.',
      connexionRefusee: 'Connexion refusée. Vérifiez vos identifiants.',
      mdpTropCourt: 'Le mot de passe doit contenir au moins 8 caractères.',
      mdpDifferents: 'Les mots de passe ne correspondent pas.',
      appleEchec: "La connexion avec Apple n'a pas pu démarrer. Réessayez dans un instant.",
      inscriptionEchec: 'Inscription impossible. Cette adresse est peut-être déjà utilisée.',
      inscriptionOk: 'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.',
    },
    stats: { jour: "Aujourd'hui", total: 'Vérifiés', fiable: 'Fiable' },
    solde: { prefixe: 'Solde : ', suffixe: ' pièce(s)' },
    verif: {
      iphone: 'iPhone — 1 pièce', macbook: 'MacBook — 2 pièces',
      imeiLabel: 'IMEI ou numéro de série', imeiPh: "Composez *#06# sur l'appareil",
      btn: 'Vérifier maintenant',
      etape0: 'Connexion au fournisseur…', etape1: 'Vérification Apple (iCloud, garantie)…',
      etape2: 'Vérification opérateur et liste noire…', etape3: 'Compilation du rapport…',
      imeiInvalide: 'Saisissez un IMEI ou un numéro de série valide.',
      erreurDefaut: "La vérification n'a pas pu aboutir. Réessayez dans un instant.",
      introuvable: 'Appareil introuvable.',
      recharger: 'Recharger mes pièces',
    },
    controles: {
      titre: 'Ce que PhoneScore contrôle',
      sub: 'À partir du seul code IMEI, auprès des bases constructeur et GSMA.',
      icloudT: 'Verrou iCloud', icloudD: "— le point le plus coûteux : un appareil lié à « Localiser » est inutilisable, et personne ne peut le débloquer.",
      voleT: 'Déclaré volé ou perdu', voleD: '— inscription sur liste noire GSMA. Un appareil signalé peut être coupé du réseau à tout moment.',
      simlockT: 'Verrou opérateur', simlockD: "— un téléphone SIM-locké n'accepte que l'opérateur d'origine, souvent étranger.",
      modeleT: 'Modèle et capacité réels', modeleD: "— ce qui a été fabriqué sous cet IMEI, quoi qu'annonce le vendeur.",
      esimT: 'Cartes SIM et eSIM', esimD: '— les iPhone américains depuis le 14 n\'ont aucun tiroir SIM. Le rapport le signale.',
      garantieT: 'Garantie', garantieD: "— date d'achat et couverture Apple restante, quand l'information existe.",
      partageT: 'Rapport partageable', partageD: '— à envoyer au vendeur ou à l\'acheteur par WhatsApp.',
      lien: 'Ce que chaque ligne veut dire', lienSuite: ", et quoi vérifier sur l'appareil.",
    },
    comment: {
      titre: 'Comment ça marche', sub: "Trois gestes, moins d'une minute.",
      s1T: "Relevez l'IMEI", s1Da: 'Composez ', s1Db: ' sur le téléphone à vérifier, ou scannez le code-barres avec l\'appareil photo.',
      s2T: 'Lancez la vérification', s2D: 'PhoneScore interroge les bases officielles et renvoie le rapport en quelques secondes.',
      s3T: 'Décidez', s3D: 'Verdict vert, vous pouvez conclure. Verdict rouge, passez votre chemin — et gardez le rapport comme preuve.',
      s3Lien: 'Comprendre chaque ligne du rapport',
    },
    revendeurs: {
      titre: 'Pour les revendeurs', sub: "Les outils du métier, inclus dans l'application.",
      annuaireT: "Votre boutique dans l'annuaire",
      annuaireD: "Inscrivez votre boutique, indiquez sa position, et laissez vos clients vous contacter directement par WhatsApp. Les boutiques proches de l'acheteur apparaissent en premier. L'inscription demande le Pack Revendeur, qui ouvre 30 jours d'accès.",
      badgeT: 'Badge Certifiée',
      badgeD: 'Les boutiques qui vérifient régulièrement leurs appareils affichent un badge de confiance visible par les acheteurs.',
      badgeLien: "Comment l'obtenir",
      stockT: 'Stock et factures',
      stockD: "Suivez vos appareils en stock, vos prix d'achat et de vente, et éditez une facture propre pour chaque client.",
    },
    footer: { marque: 'PhoneScore' },
    cta: { avant: 'Vous préférez l’application ?', lien: 'Télécharger sur l’App Store' },
  },
  en: {
    nav: {
      profil: 'Profile', historique: 'History', assistance: 'Support',
      rapport: 'Understanding the report', revendeurs: 'Shop badge',
      cgu: 'Terms of Service', confidentialite: 'Privacy Policy',
    },
    hero: { lead: 'Check before you buy' },
    auth: {
      sousTitreConnexion: 'Sign in to check a device.',
      sousTitreInscription: 'Create an account in seconds — then check a device.',
      apple: 'Continue with Apple',
      ou: 'or',
      emailLabel: 'Email address', emailPh: 'you@example.com',
      mdpLabel: 'Password', mdpPh: 'At least 8 characters',
      mdpConfirmLabel: 'Confirm password', mdpConfirmPh: 'Type the same password again',
      connexion: 'Sign in', inscription: 'Create account',
      basculerVersInscription: 'Create a new account', basculerVersConnexion: 'I already have an account',
      mdpOublie: 'Forgot password?',
      legalPrefixe: 'By creating an account, you agree to the',
      legalCgu: 'Terms of Service', legalEt: 'and the', legalConfidentialite: 'Privacy Policy',
      champsManquants: 'Enter your email and password.',
      connexionRefusee: 'Sign-in failed. Check your credentials.',
      mdpTropCourt: 'Password must be at least 8 characters.',
      mdpDifferents: "Passwords don't match.",
      appleEchec: "Sign in with Apple couldn't start. Try again in a moment.",
      inscriptionEchec: 'Sign-up failed. This email may already be in use.',
      inscriptionOk: 'Account created. Check your inbox to confirm your address.',
    },
    stats: { jour: 'Today', total: 'Checked', fiable: 'Clean rate' },
    solde: { prefixe: 'Balance: ', suffixe: ' coin(s)' },
    verif: {
      iphone: 'iPhone — 1 coin', macbook: 'MacBook — 2 coins',
      imeiLabel: 'IMEI or serial number', imeiPh: 'Dial *#06# on the device',
      btn: 'Check now',
      etape0: 'Connecting to the provider…', etape1: 'Checking with Apple (iCloud, warranty)…',
      etape2: 'Checking carrier and blacklist…', etape3: 'Compiling the report…',
      imeiInvalide: 'Enter a valid IMEI or serial number.',
      erreurDefaut: 'The check could not complete. Try again in a moment.',
      introuvable: 'Device not found.',
      recharger: 'Buy more coins',
    },
    controles: {
      titre: 'What PhoneScore checks',
      sub: 'From the IMEI alone, against the manufacturer and GSMA databases.',
      icloudT: 'iCloud lock', icloudD: '— the costliest issue: a device tied to "Find My" is unusable, and no one can unlock it.',
      voleT: 'Reported stolen or lost', voleD: '— GSMA blacklist entry. A flagged device can be cut off the network at any time.',
      simlockT: 'Carrier lock', simlockD: '— a SIM-locked phone only accepts its original carrier, often a foreign one.',
      modeleT: 'Real model and capacity', modeleD: '— what was actually manufactured under this IMEI, regardless of what the seller claims.',
      esimT: 'SIM cards and eSIM', esimD: "— US iPhones since the 14 have no SIM tray at all. The report flags it.",
      garantieT: 'Warranty', garantieD: '— purchase date and remaining Apple coverage, when the information exists.',
      partageT: 'Shareable report', partageD: '— send it to the seller or buyer over WhatsApp.',
      lien: 'What each line means', lienSuite: ', and what to check on the device.',
    },
    comment: {
      titre: 'How it works', sub: 'Three steps, under a minute.',
      s1T: 'Get the IMEI', s1Da: 'Dial ', s1Db: ' on the phone to check, or scan the barcode with the camera.',
      s2T: 'Run the check', s2D: 'PhoneScore queries official databases and returns the report in seconds.',
      s3T: 'Decide', s3D: "Green verdict, you can go ahead. Red verdict, walk away — and keep the report as proof.",
      s3Lien: 'Understand every line of the report',
    },
    revendeurs: {
      titre: 'For resellers', sub: 'Professional tools, built into the app.',
      annuaireT: 'Your shop in the directory',
      annuaireD: "List your shop, set its location, and let customers reach you directly on WhatsApp. Shops closer to the buyer show up first. Listing requires the Reseller Pack, which unlocks 30 days of access.",
      badgeT: 'Certified badge',
      badgeD: 'Shops that check their devices regularly display a trust badge buyers can see.',
      badgeLien: 'How to get it',
      stockT: 'Stock and invoices',
      stockD: 'Track your devices in stock, your buy and sell prices, and issue a clean invoice for every customer.',
    },
    footer: { marque: 'PhoneScore' },
    cta: { avant: 'Prefer the app?', lien: 'Download on the App Store' },
  },
};

function cheminValeur(objet, chemin) {
  return chemin.split('.').reduce((o, k) => (o ? o[k] : undefined), objet);
}

function detecterLangueParDefaut() {
  const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  return nav === 'fr' ? 'fr' : 'en';
}

function langueActuelle() {
  const sauvee = localStorage.getItem(LANGUE_CLE);
  return LANGUES_SUPPORTEES.includes(sauvee) ? sauvee : detecterLangueParDefaut();
}

function t(cle) {
  const dict = TRADUCTIONS[langueActuelle()] || TRADUCTIONS.fr;
  return cheminValeur(dict, cle) ?? cheminValeur(TRADUCTIONS.fr, cle) ?? cle;
}

function appliquerTraductions() {
  document.documentElement.lang = langueActuelle();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
  document.querySelectorAll('[data-i18n-lang-actif]').forEach(el => {
    el.classList.toggle('actif', el.getAttribute('data-i18n-lang-actif') === langueActuelle());
  });
}

// CSP interdit les gestionnaires inline (onclick=...) : le bouton de langue
// ne porte qu'un data-langue, l'ecoute est posee ici, seul fichier autorise
// a executer du JS sur cette page.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-langue]').forEach(btn => {
    btn.addEventListener('click', () => definirLangue(btn.getAttribute('data-langue')));
  });
});

function definirLangue(langue) {
  if (!LANGUES_SUPPORTEES.includes(langue)) return;
  localStorage.setItem(LANGUE_CLE, langue);
  appliquerTraductions();
  document.dispatchEvent(new CustomEvent('langue-changee', { detail: { langue } }));
}

document.addEventListener('DOMContentLoaded', appliquerTraductions);

// Expose au script non-module accueil.js (charge apres celui-ci) pour les
// textes qu'il ecrit lui-meme au fil de l'auth (bascule connexion/inscription,
// messages d'erreur).
window.PSI18N = { t, langueActuelle, definirLangue };
