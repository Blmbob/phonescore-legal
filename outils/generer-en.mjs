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
  // Guides : une adresse anglaise propre (`en`), les mots-cles de la
  // recherche anglaise n'etant pas ceux du slug francais.
  {
    fichier: 'iphone-vole.html', chemin: '/iphone-vole', en: '/en/stolen-iphone-check',
    titre: 'How to check if an iPhone is stolen before buying — PhoneScore',
    description: 'Before buying a used iPhone: the warning signs, and how to check the IMEI, the blacklist and iCloud Activation Lock in minutes.',
    fil: 'Check if an iPhone is stolen',
    article: { publie: '2026-09-29', titre: 'How to check if an iPhone is stolen' },
  },
  {
    fichier: 'verifier-imei-iphone.html', chemin: '/verifier-imei-iphone', en: '/en/iphone-imei-check',
    titre: 'iPhone IMEI check: where to find it and what it reveals — PhoneScore',
    description: 'Where to find an iPhone IMEI (*#06#, Settings, box, locked iPhone) and what a check reveals: real model, blacklist, iCloud lock, carrier lock, warranty.',
    fil: 'iPhone IMEI check',
    article: { publie: '2026-09-29', titre: 'iPhone IMEI check' },
  },
  {
    fichier: 'verrou-icloud.html', chemin: '/verrou-icloud', en: '/en/icloud-lock-check',
    titre: 'iCloud lock check before buying an iPhone or Mac — PhoneScore',
    description: 'Spot an active iCloud Activation Lock, have it removed in front of you on iPhone, iPad or Mac, and know who can really unlock it.',
    fil: 'iCloud lock check',
    article: { publie: '2026-09-29', titre: 'iCloud lock check before you buy' },
  },
  {
    fichier: 'iphone-blackliste.html', chemin: '/iphone-blackliste', en: '/en/iphone-blacklist-check',
    titre: 'iPhone blacklist check before buying — PhoneScore',
    description: 'What a blacklisted iPhone means (theft, loss, unpaid bills), the delayed trap of a block for unpaid bills, how to check the IMEI and who can lift the block.',
    fil: 'iPhone blacklist check',
    article: { publie: '2026-09-29', titre: 'iPhone blacklist check before buying' },
  },
  {
    fichier: 'iphone-bloque-operateur.html', chemin: '/iphone-bloque-operateur', en: '/en/iphone-carrier-lock-check',
    titre: 'iPhone carrier lock check: spot it and unlock it — PhoneScore',
    description: 'See in 30 seconds whether an iPhone is locked to a carrier (Settings, SIM card), the case of eSIM-only US iPhones, and who can really unlock it.',
    fil: 'iPhone carrier lock check',
    article: { publie: '2026-09-29', titre: 'iPhone carrier lock check' },
  },
  {
    fichier: 'acheter-iphone-occasion.html', chemin: '/acheter-iphone-occasion', en: '/en/used-iphone-checklist',
    titre: 'Buying a used iPhone: the complete checklist — PhoneScore',
    description: 'What to check before buying a used iPhone: IMEI, iCloud lock, blacklist, carrier lock, battery, parts, screen, Face ID, and what to require before paying.',
    fil: 'Used iPhone checklist',
    article: { publie: '2026-09-29', titre: 'Buying a used iPhone: what to check' },
  },
];

const EN_PARTICULIERS = Object.fromEntries(PAGES.filter(p => p.en).map(p => [p.chemin, p.en]));
const cheminEn = c => EN_PARTICULIERS[c] ?? (c === '/' ? '/en/' : '/en' + c);
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
      page.article
        ? {
          '@type': 'Article', '@id': `${url}#article`, headline: page.article.titre,
          description: page.description, inLanguage: 'en',
          datePublished: page.article.publie, dateModified: dateModif(page.fichier),
          image: `${SITE}/og-image.png`,
          author: { '@id': `${SITE}/#organization` }, publisher: { '@id': `${SITE}/#organization` },
          isPartOf: { '@id': `${SITE}/en/#website` }, mainEntityOfPage: url,
        }
        : {
          '@type': 'WebPage', '@id': `${url}#page`, url, name: page.titre,
          description: page.description, inLanguage: 'en',
          isPartOf: { '@id': `${SITE}/en/#website` }, publisher: { '@id': `${SITE}/#organization` },
        },
    ];
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graphe }, null, 2);
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

// Le badge officiel n'existe ici qu'en francais : les pages anglaises recoivent un
// bouton texte de meme emplacement (a remplacer par le badge officiel anglais).
const BADGE_EN = '<p class="badge-zone"><a class="badge-texte" href="https://apps.apple.com/app/id6795897093">'
  + '<svg viewBox="0 0 170 170" aria-hidden="true"><path fill="currentColor" d="M150.4 128.8c-2.6 6-5.7 11.5-9.4 16.6-5.1 7-9.3 11.9-12.4 14.5-4.9 4.4-10.1 6.7-15.7 6.8-4 0-8.9-1.1-14.6-3.4-5.7-2.3-11-3.4-15.7-3.4-5 0-10.4 1.1-16.2 3.4-5.8 2.3-10.5 3.5-14.1 3.7-5.4.2-10.8-2.1-16.2-7-3.4-3-7.7-8.1-12.9-15.3-5.5-7.7-10.1-16.6-13.6-26.7-3.8-11.1-5.7-21.8-5.7-32.2 0-11.9 2.6-22.2 7.7-30.8 4-6.8 9.4-12.2 16-16.1 6.6-3.9 13.8-6 21.5-6.1 4.2 0 9.7 1.3 16.6 3.8 6.8 2.6 11.2 3.8 13.1 3.8 1.4 0 6.3-1.5 14.5-4.5 7.8-2.8 14.4-4 19.8-3.5 14.6 1.2 25.6 6.9 32.9 17.3-13.1 7.9-19.5 19-19.4 33.2.1 11.1 4.1 20.3 12 27.7 3.6 3.4 7.6 6 12 7.9-1 2.8-2 5.4-3.2 8zM119.1 7.2c0 8.7-3.2 16.8-9.5 24.4-7.6 8.9-16.8 14-26.8 13.2-.1-1-.2-2.1-.2-3.2 0-8.4 3.7-17.3 10.1-24.6 3.2-3.7 7.3-6.8 12.2-9.2 4.9-2.4 9.5-3.7 13.9-3.9.1 1.1.2 2.2.2 3.3z"/></svg>'
  + '<span>Download on the App Store</span></a></p>';

// --- Construction d'une page anglaise. -------------------------------------
function versionAnglaise(fr, page, manquantes) {
  let html = fr;
  const url = SITE + cheminEn(page.chemin);
  const t = echapperAttr(page.titre);
  const d = echapperAttr(page.description);

  html = html.replace(/<html lang="fr"[^>]*>/, '<html lang="en" data-langue-fixe>');
  html = html.replace(/<p class="badge-zone[^"]*">[\s\S]*?<\/p>/g, m => BADGE_EN.replace('badge-zone', m.match(/class="(badge-zone[^"]*)"/)[1]));
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
  const priorite = { '/': '1.0', '/rapport': '0.8', '/assistance': '0.8', '/revendeurs': '0.7', '/iphone-vole': '0.9', '/verifier-imei-iphone': '0.9', '/verrou-icloud': '0.9', '/iphone-blackliste': '0.9', '/iphone-bloque-operateur': '0.9', '/acheter-iphone-occasion': '0.9' };
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

  const fichierEn = page.en ? page.en.slice(1) + '.html' : 'en/' + page.fichier;
  fs.writeFileSync(path.join(RACINE, fichierEn), versionAnglaise(fr, page, manquantes));
  console.log(fichierEn);
}

fs.writeFileSync(path.join(RACINE, 'sitemap.xml'), sitemap());
console.log('sitemap.xml');

if (manquantes.size) {
  console.warn(`\n${manquantes.size} cle(s) sans traduction anglaise (texte francais garde) :`);
  for (const c of manquantes) console.warn('  ' + c);
  process.exitCode = 1;
}
