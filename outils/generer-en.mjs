// Genere la version anglaise des pages publiques dans en/, et relie les deux
// langues par des balises hreflang.
//
// A LANCER APRES TOUTE MODIFICATION D'UNE PAGE PUBLIQUE OU DE js/i18n.js,
// et APRES outils/versionner-assets.py (les empreintes ?v= sont recopiees) :
//
//     python outils/versionner-assets.py
//     node outils/generer-en.mjs
//
// Pourquoi -- jusqu'au 29 sept. 2026, chaque page n'avait qu'une adresse et
// js/i18n.js la traduisait dans le navigateur selon navigator.language.
// Googlebot navigue en anglais : Search Console montrait une page d'accueil
// en lang="en" sous un titre francais, et aucune des deux langues n'etait
// correctement referencee. Desormais chaque langue a son adresse (/rapport,
// /en/rapport), un HTML deja traduit, et une langue fixe
// (data-langue-fixe) que le navigateur ne remplace plus.
//
// Source unique : les pages francaises + le dictionnaire `en` de js/i18n.js.
// Ne jamais modifier en/ a la main, c'est ecrase a chaque execution.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE = 'https://phonescore.app';

// Pages publiques indexables. Les pages de compte (profil, historique,
// recharger...) sont noindex et gardent leur traduction dans le navigateur.
const PAGES = [
  {
    fichier: 'index.html', chemin: '/',
    titre: 'PhoneScore — Check a used iPhone before you buy it',
    description: 'Find out in seconds whether a used iPhone or MacBook is iCloud locked, reported stolen or carrier locked.',
    fil: null,
  },
  {
    fichier: 'rapport.html', chemin: '/rapport',
    titre: 'Understanding the report — PhoneScore',
    description: 'iCloud lock, GSMA blacklist, SIM lock, refurbished, eSIM: what each line of the PhoneScore report means, and what it should make you do before buying.',
    fil: 'Understanding the report',
  },
  {
    fichier: 'assistance.html', chemin: '/assistance',
    titre: 'Support — PhoneScore',
    description: 'PhoneScore support: frequently asked questions, account deletion, and how to reach us.',
    fil: 'Support',
  },
  {
    fichier: 'revendeurs.html', chemin: '/revendeurs',
    titre: 'Certified shop badge for phone resellers — PhoneScore',
    description: 'The PhoneScore Certified badge is earned: 10 checks over a rolling 30 days. It proves to your customers that you check your devices before selling them.',
    fil: 'Shop badge',
  },
  {
    fichier: 'cgu.html', chemin: '/cgu',
    titre: 'Terms of Service — PhoneScore',
    description: 'PhoneScore terms of service: pieces, in-app purchases, refunds and liability.',
    fil: 'Terms of Service',
  },
  {
    fichier: 'confidentialite.html', chemin: '/confidentialite',
    titre: 'Privacy Policy — PhoneScore',
    description: 'What data PhoneScore collects, why, who it is shared with, and how to delete your account.',
    fil: 'Privacy Policy',
  },
];

const cheminEn = c => (c === '/' ? '/en/' : '/en' + c);
const CHEMINS_PUBLICS = new Set(PAGES.map(p => p.chemin));

// --- Dictionnaire : js/i18n.js execute dans un bac a sable sans DOM. -------
function chargerDictionnaire() {
  const code = fs.readFileSync(path.join(RACINE, 'js/i18n.js'), 'utf8')
    + '\n;globalThis.__TRADUCTIONS = TRADUCTIONS;';
  const bac = {
    document: { addEventListener() {}, documentElement: { hasAttribute: () => false } },
    window: {}, navigator: { language: 'en' }, localStorage: { getItem: () => null },
  };
  bac.globalThis = bac;
  vm.runInNewContext(code, bac);
  return bac.__TRADUCTIONS.en;
}
const EN = chargerDictionnaire();
const valeurEn = cle => cle.split('.').reduce((o, k) => (o ? o[k] : undefined), EN);

const echapper = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const echapperAttr = s => echapper(s).replace(/"/g, '&quot;');

// --- Remplace le contenu des elements portant data-i18n / data-i18n-html. --
// Parcours equilibre sur le nom de balise : suffisant ici, les pages sont
// ecrites a la main et ne contiennent ni commentaire ni script dans ces
// elements.
function traduireElements(html, manquantes) {
  const motif = /<([a-zA-Z0-9]+)\b[^>]*\sdata-i18n(-html)?="([^"]+)"[^>]*>/g;
  let sortie = '';
  let curseur = 0;
  let m;
  while ((m = motif.exec(html))) {
    const [ouverture, balise, estHtml, cle] = m;
    const debutContenu = m.index + ouverture.length;
    // Fin de l'element : on compte les ouvertures/fermetures de meme nom.
    const re = new RegExp(`<(/?)${balise}\\b[^>]*>`, 'gi');
    re.lastIndex = debutContenu;
    let profondeur = 1;
    let f;
    while ((f = re.exec(html))) {
      profondeur += f[1] ? -1 : 1;
      if (profondeur === 0) break;
    }
    if (!f) throw new Error(`Balise <${balise}> non fermee pour ${cle}`);
    const valeur = valeurEn(cle);
    if (typeof valeur !== 'string') {
      manquantes.add(cle);
      continue; // texte francais conserve, signale en fin d'execution
    }
    sortie += html.slice(curseur, debutContenu) + (estHtml ? valeur : echapper(valeur));
    curseur = f.index;
    motif.lastIndex = f.index;
  }
  return sortie + html.slice(curseur);
}

function traduirePlaceholders(html, manquantes) {
  return html.replace(/<[^>]*\sdata-i18n-ph="([^"]+)"[^>]*>/g, (tag, cle) => {
    const valeur = valeurEn(cle);
    if (typeof valeur !== 'string') { manquantes.add(cle); return tag; }
    return tag.replace(/placeholder="[^"]*"/, `placeholder="${echapperAttr(valeur)}"`);
  });
}

// --- Balises hreflang, posees juste apres la canonique. --------------------
const DEBUT_ALT = '<!-- hreflang : genere par outils/generer-en.mjs -->';
const FIN_ALT = '<!-- /hreflang -->';

function blocHreflang(page) {
  return [
    DEBUT_ALT,
    `<link rel="alternate" hreflang="fr" href="${SITE}${page.chemin}">`,
    `<link rel="alternate" hreflang="en" href="${SITE}${cheminEn(page.chemin)}">`,
    // Marche mondial : un visiteur ni francophone ni anglophone lit l'anglais.
    `<link rel="alternate" hreflang="x-default" href="${SITE}${cheminEn(page.chemin)}">`,
    FIN_ALT,
  ].join('\n');
}

function poserHreflang(html, page) {
  const sans = html.replace(new RegExp(`\\n?${DEBUT_ALT}[\\s\\S]*?${FIN_ALT}`), '');
  return sans.replace(/(<link rel="canonical"[^>]*>)/, `$1\n${blocHreflang(page)}`);
}

// --- Donnees structurees de la version anglaise. ---------------------------
// Les blocs FAQ et HowTo ne sont pas repris : Google ne les affiche plus en
// resultat enrichi pour ce type de site depuis 2023, et les traduire a la main
// en double du dictionnaire ferait deux sources a tenir.
function jsonLdEn(page) {
  const url = SITE + cheminEn(page.chemin);
  const graphe = page.fil === null
    ? [
      {
        '@type': 'WebSite', '@id': `${SITE}/en/#website`, url, name: 'PhoneScore',
        inLanguage: 'en', publisher: { '@id': `${SITE}/#organization` },
      },
      {
        '@type': 'MobileApplication', name: 'PhoneScore',
        applicationCategory: 'UtilitiesApplication', operatingSystem: 'iOS',
        inLanguage: 'en', url, downloadUrl: 'https://apps.apple.com/app/id6795897093',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
        image: `${SITE}/og-image.png`,
        description: 'Check the history of a used iPhone or MacBook from its IMEI: iCloud lock, blacklist status, carrier lock, real model and warranty.',
        publisher: { '@id': `${SITE}/#organization` },
      },
    ]
    : [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/en/` },
          { '@type': 'ListItem', position: 2, name: page.fil },
        ],
      },
      {
        '@type': 'WebPage', '@id': `${url}#page`, url, name: page.titre,
        description: page.description, inLanguage: 'en',
        isPartOf: { '@id': `${SITE}/en/#website` }, publisher: { '@id': `${SITE}/#organization` },
      },
    ];
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graphe }, null, 2);
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

// --- Construction d'une page anglaise. -------------------------------------
function versionAnglaise(fr, page, manquantes) {
  let html = fr;
  const url = SITE + cheminEn(page.chemin);
  const t = echapperAttr(page.titre);
  const d = echapperAttr(page.description);

  html = html.replace(/<html lang="fr"[^>]*>/, '<html lang="en" data-langue-fixe>');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${echapper(page.titre)}</title>`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*"/, `$1${url}"`);
  html = html.replace(/(<meta name="description" content=")[^"]*"/, `$1${d}"`);
  html = html.replace(/(<meta property="og:locale" content=")[^"]*"/, '$1en_US"');
  html = html.replace(/(<meta property="og:url" content=")[^"]*"/, `$1${url}"`);
  html = html.replace(/(<meta (?:property="og|name="twitter):title" content=")[^"]*"/g, `$1${t}"`);
  html = html.replace(/(<meta (?:property="og|name="twitter):description" content=")[^"]*"/g, `$1${d}"`);
  // La verification Search Console ne vaut que pour l'accueil racine.
  html = html.replace(/<!-- Propriete Search Console[\s\S]*?<meta name="google-site-verification"[^>]*>\n?/, '');
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, jsonLdEn(page));

  html = traduireElements(html, manquantes);
  html = traduirePlaceholders(html, manquantes);

  // Liens internes vers les pages publiques : on reste dans la langue.
  html = html.replace(/href="(\/[a-z-]*)(#[^"]*)?"/g, (tout, chemin, ancre = '') =>
    CHEMINS_PUBLICS.has(chemin) ? `href="${cheminEn(chemin)}${ancre}"` : tout);

  return poserHreflang(html, page);
}

// --- Sitemap : les deux langues, reliees entre elles. ----------------------
function dateModif(fichier) {
  try {
    const d = execSync(`git log -1 --format=%cs -- "${fichier}"`, { cwd: RACINE }).toString().trim();
    if (d) return d;
  } catch { /* hors depot git */ }
  return new Date().toISOString().slice(0, 10);
}

function sitemap() {
  const priorite = { '/': '1.0', '/rapport': '0.8', '/assistance': '0.8', '/revendeurs': '0.7' };
  const entrees = [];
  for (const page of PAGES) {
    const lastmod = dateModif(page.fichier);
    const alternatives = blocHreflang(page).split('\n').slice(1, -1)
      .map(l => l.replace(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/,
        '    <xhtml:link rel="alternate" hreflang="$1" href="$2"/>'))
      .join('\n');
    for (const loc of [SITE + page.chemin, SITE + cheminEn(page.chemin)]) {
      entrees.push(`  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
${alternatives}
    <priority>${priorite[page.chemin] ?? '0.3'}</priority>
  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Genere par outils/generer-en.mjs : ne pas modifier a la main. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entrees.join('\n')}
</urlset>
`;
}

// --- Execution. ------------------------------------------------------------
const manquantes = new Set();
fs.mkdirSync(path.join(RACINE, 'en'), { recursive: true });

for (const page of PAGES) {
  const cheminFr = path.join(RACINE, page.fichier);
  let fr = fs.readFileSync(cheminFr, 'utf8');

  // Page francaise : langue fixe + hreflang (idempotent).
  const frMaj = poserHreflang(
    fr.replace(/<html lang="fr"(?: data-langue-fixe)?>/, '<html lang="fr" data-langue-fixe>'), page);
  if (frMaj !== fr) fs.writeFileSync(cheminFr, frMaj);
  fr = frMaj;

  fs.writeFileSync(path.join(RACINE, 'en', page.fichier), versionAnglaise(fr, page, manquantes));
  console.log(`en/${page.fichier}`);
}

fs.writeFileSync(path.join(RACINE, 'sitemap.xml'), sitemap());
console.log('sitemap.xml');

if (manquantes.size) {
  console.warn(`\n${manquantes.size} cle(s) sans traduction anglaise (texte francais garde) :`);
  for (const c of manquantes) console.warn('  ' + c);
  process.exitCode = 1;
}
