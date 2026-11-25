/* Rendu du rapport IMEI, partage entre index.html (resultat d'une nouvelle
   verification) et profil.html (detail d'un element de l'historique).
   Script classique (pas de type="module") expres : ses `const`/`function` du
   premier niveau restent visibles comme identifiants globaux pour les scripts
   modules charges apres lui sur la meme page, sans passer par window.*.

   Doublon volontaire de lib/imei-advice.ts et de components/imei-report.tsx
   cote app : ce site est du JS brut sans etape de build, donc pas d'import
   possible depuis le depot phonescore54. Ne garder que les libelles COURTS
   ("short") : la version longue ("full") depend de l'appareil et n'est
   affichee nulle part ici. */

function LIBELLE() {
  return {
    safe:    { titre: PSI18N.t('rapportCommun.verdictSafeTitre'), detail: PSI18N.t('rapportCommun.verdictSafeDetail') },
    warning: { titre: PSI18N.t('rapportCommun.verdictWarningTitre'), detail: PSI18N.t('rapportCommun.verdictWarningDetail') },
    danger:  { titre: PSI18N.t('rapportCommun.verdictDangerTitre'), detail: PSI18N.t('rapportCommun.verdictDangerDetail') },
  };
}

/* Les valeurs viennent de Sickw : elles sont affichees, jamais interpretees. */
const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function echapper(valeur) {
  return String(valeur).replace(/[&<>"']/g, c => ENTITES[c]);
}

/* « Activated » / « Not Activated » de Sickw, traduits ; toute autre valeur
   est affichée telle quelle plutôt que devinée. */
function statutActivation(valeur) {
  const v = String(valeur ?? '').trim();
  if (!v) return '';
  if (/^not\s+activated$/i.test(v)) return PSI18N.t('rapportCommun.nonActive');
  if (/^activated$/i.test(v)) return PSI18N.t('rapportCommun.active');
  if (/^purchase date not validated$/i.test(v)) return PSI18N.t('rapportCommun.dateNonValidee');
  return v;
}

/* Opérateur d'origine lu dans la politique Apple, même débloqué (comme l'app,
   lib/operateur.ts) : « 2023 - US Verizon LTE Unlocked Policy » -> Verizon LTE,
   États-Unis. Politique générique (« 10 - Unlock. ») : null. */
const PREFIXES_PAYS_OPERATEUR = [
  [/^US\s+/i, 'États-Unis'], [/^Canada\s+/i, 'Canada'], [/^Hong Kong(\s+and\s+Macau)?\s+/i, 'Hong Kong'],
  [/^Japan\s+/i, 'Japon'], [/^UK\s+/i, 'Royaume-Uni'], [/^Mexico\s+/i, 'Mexique'], [/^France\s+/i, 'France'],
];
function operateurOrigine(brut) {
  if (!brut) return null;
  let nom = String(brut).trim().replace(/^\d+\s*-\s*/, '').replace(/\.$/, '').trim();
  if (!nom || /^(unlock(ed)?|multi-mode unlock( service)?|n\/a\b.*)$/i.test(nom)) return null;
  nom = nom.replace(/\s+(locked|unlocked|activation)\s+policy$/i, '').trim();
  for (const [motif, pays] of PREFIXES_PAYS_OPERATEUR) {
    if (motif.test(nom)) {
      const reste = nom.replace(motif, '').trim();
      return reste ? { nom: reste, pays } : null;
    }
  }
  return { nom };
}

function ligne(cle, valeur, ton) {
  if (valeur === undefined || valeur === null || valeur === '') return '';
  const classe = ton ? ` class="${ton}"` : '';
  return `<dt>${cle}</dt><dd${classe}>${echapper(valeur)}</dd>`;
}

/* Configuration SIM — meme regle que l'application (lib/sim-config.ts, 23 nov. 2026).

   Sans tiroir SIM (eSIM uniquement) : iPhone Air et Duo partout ; iPhone 14 a 16
   vendus aux Etats-Unis ; iPhone 17 et suivants vendus aux Etats-Unis, Canada,
   Mexique, Japon, Guam, iles Vierges americaines et pays du Golfe.

   Le PAYS D'ACHAT decide quand il est connu. Sinon, la ZONE DE VENTE : d'abord
   celle du numero de modele Apple (js/zones-vente.js, page officielle Apple),
   a defaut le code region du libelle (NAUS = Etats-Unis ; NAJP = Amerique du
   Nord, Japon et Golfe, decisif seulement a partir de l'iPhone 17 : le Japon et
   le Canada ont garde leur tiroir jusqu'a l'iPhone 16).

   IMEI2 est la donnee sure : un second IMEI prouve deux lignes. */
const PREMIERE_GENERATION_SANS_TIROIR = 14;
const PREMIERE_GENERATION_ELARGIE = 17;
const MARCHES_SANS_TIROIR_DES_17 = [
  /^(usa|us|united states|etats[-\s]?unis|états[-\s]?unis)\b/i,
  /^canada\b/i, /^mexico\b|^mexique\b|^méxico\b/i, /^japan\b|^japon\b/i, /^guam\b/i,
  /virgin islands/i, /^bahrain\b|^bahre[iï]n\b/i, /^kuwait\b|^kowe[iï]t\b/i, /^oman\b/i,
  /^qatar\b/i, /^saudi arabia\b|^arabie saoudite\b/i, /^(uae|united arab emirates|emirats|émirats)\b/i,
];

function generationIphone(modele) {
  // « IPHONE 17 PRO,ROW,… », « SVC,IPHONE 17E,NAJP,… » : préfixe possible, « E » collé.
  const m = String(modele || '').trim().match(/(?:^|,)\s*IPHONE\s+(\d{1,2})(?!\d)/i);
  return m ? Number(m[1]) : null;
}

function estEtatsUnis(pays) {
  return /^(usa|us|united states|etats[-\s]?unis|états[-\s]?unis)\b/i.test(String(pays || '').trim());
}

function estIphoneAir(modele) {
  return /^IPHONE\s+(AIR|DUO)\b/i.test(String(modele || '').trim());
}

/* « N/A » (anciens rapports) n'est pas un pays. */
function paysConnu(pays) {
  const p = String(pays || '').trim();
  return p && !/^(n\s*\/\s*a|not available|unknown|none|-{1,2})$/i.test(p) ? p : '';
}

function zoneVente(numero) {
  if (!numero || typeof ZONES_VENTE === 'undefined') return null;
  return ZONES_VENTE[String(numero).trim().toUpperCase()] || null;
}

function zoneDuRapport(r) {
  const parNumero = zoneVente(numeroModeleApple(r.raw)?.numero || r.numeroModele);
  if (parNumero) return parNumero;
  const code = String(r.model || '').toUpperCase().split(',').map(s => s.trim()).find(s => s === 'NAUS' || s === 'NAJP');
  return code === 'NAUS' ? 'usa' : code === 'NAJP' ? 'canada-japon' : null;
}

function sansTiroirProbable(r, generation) {
  if (estIphoneAir(r.model)) return true;
  if (generation === null) return false;
  const pays = paysConnu(r.purchaseCountry) || operateurOrigine(r.carrier)?.pays || '';
  if (!pays) {
    const zone = zoneDuRapport(r);
    if (!zone) return false;
    if (generation >= PREMIERE_GENERATION_ELARGIE) return !['monde', 'chine', 'chine-hk', 'russie'].includes(zone);
    return generation >= PREMIERE_GENERATION_SANS_TIROIR && zone === 'usa';
  }
  if (generation >= PREMIERE_GENERATION_ELARGIE) return MARCHES_SANS_TIROIR_DES_17.some(re => re.test(pays));
  return generation >= PREMIERE_GENERATION_SANS_TIROIR && estEtatsUnis(pays);
}

function configurationSim(r) {
  if (r.deviceFamily && r.deviceFamily !== 'iphone') return null;

  const generation = generationIphone(r.model);
  const doubleSim = typeof r.imei2 === 'string' && r.imei2.trim() !== '';
  const esimSeuleProbable = sansTiroirProbable(r, generation);

  if (!doubleSim && !esimSeuleProbable) return null;
  return { doubleSim, esimSeuleProbable };
}

function estMac(r) {
  return r.deviceFamily === 'mac';
}

/* Un rapport « sur » alors que l'appareil est verrouille sur un operateur
   s'affiche « A verifier » (lib/imei-report.ts, verdictEffectif). */
function verdictAffiche(r) {
  return r.verdict === 'safe' && r.simLockStatus === 'locked' ? 'warning' : r.verdict;
}

/* Numero de modele Apple (A2402...) et identifiant (iPhone13,2), lus dans la
   ligne « Model: » du texte brut. Jamais deduit du nom (lib/numero-modele.ts). */
function numeroModeleApple(raw) {
  if (!raw) return null;
  for (const l of String(raw).split(/\r?\n|<br\s*\/?>/i)) {
    if (!/^\s*model\s*:/i.test(l)) continue;
    const numero = l.match(/(?<![A-Za-z0-9])(A\d{4})(?![A-Za-z0-9])/)?.[1];
    if (!numero) continue;
    const identifiant = l.match(/\[?\b((?:iPhone|iPad)\d{1,2},\d{1,2})\b\]?/)?.[1];
    return identifiant ? { numero, identifiant } : { numero };
  }
  return null;
}

/* Date d'achat impossible : avant le premier iPhone, ou dans le futur. Valeur
   par defaut de la base d'Apple, vue sur des appareils reconditionnes hors
   Apple ou de remplacement (lib/date-achat.ts). */
const SORTIE_PREMIER_IPHONE = Date.UTC(2007, 5, 29);
function problemeDateAchat(valeur) {
  const texte = String(valeur ?? '').trim();
  if (!texte) return null;
  const iso = texte.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const date = iso ? Date.UTC(+iso[1], +iso[2] - 1, +iso[3]) : new Date(texte).getTime();
  if (!Number.isNaN(date)) {
    if (date < SORTIE_PREMIER_IPHONE) return 'trop-ancienne';
    if (date > Date.now() + 2 * 24 * 3600 * 1000) return 'future';
    return null;
  }
  const annee = texte.match(/\b(19|20)\d{2}\b/);
  return annee && Number(annee[0]) < 2007 ? 'trop-ancienne' : null;
}

/* Memes regles que l'app (lib/date-achat.ts, decision du 20 oct. 2026) :
   - date trop ancienne (avant 2007) ou anterieure a la sortie du modele (verdict
     serveur « date-avant-sortie ») : achat non verifie, bandeau « Reconditionne » ;
   - date dans le futur : simple indice, « a verifier », jamais « Reconditionne » ;
   - iPhone jamais active dont l'achat est estime dans les 60 jours : profil d'un
     appareil neuf, rien a signaler.
   Avant le 18 nov. 2026, le site traitait toute date future comme impossible et
   affichait « Reconditionne — ne pas acheter » sur des iPhone neufs que l'app
   donnait « Sur ». */
const FUTUR_NEUF_MAX_MS = 60 * 24 * 3600 * 1000;
function dateImpossible(r) {
  return problemeDateAchat(r.estimatedPurchaseDate) === 'trop-ancienne'
    || r.verdictRaison === 'date-avant-sortie' || r.verdictRaison === 'date-impossible';
}
function neufNonActive(r) {
  if (problemeDateAchat(r.estimatedPurchaseDate) !== 'future') return false;
  if (!/^(not\s*activated|non\s*activ)/i.test(String(r.activationStatus ?? '').trim())) return false;
  const iso = String(r.estimatedPurchaseDate).match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const date = iso ? Date.UTC(+iso[1], +iso[2] - 1, +iso[3]) : new Date(r.estimatedPurchaseDate).getTime();
  return !Number.isNaN(date) && date <= Date.now() + FUTUR_NEUF_MAX_MS;
}
function dateFutureASignaler(r) {
  return problemeDateAchat(r.estimatedPurchaseDate) === 'future' && !neufNonActive(r);
}

function CONSEQUENCE() {
  return {
    fmiOn: PSI18N.t('rapportCommun.consFmiOn'),
    fmiUnknown: PSI18N.t('rapportCommun.consFmiUnknown'),
    fmiOffConfirm: PSI18N.t('rapportCommun.consFmiOffConfirm'),
    blacklist: PSI18N.t('rapportCommun.consBlacklist'),
    simlock: PSI18N.t('rapportCommun.consSimlock'),
    esim: PSI18N.t('rapportCommun.consEsim'),
    clean: PSI18N.t('rapportCommun.consClean'),
    partial: PSI18N.t('rapportCommun.consPartial'),
    mdm: PSI18N.t('rapportCommun.consMdm'),
    mdmIphone: PSI18N.t('rapportCommun.consMdmIphone'),
    macModele: PSI18N.t('rapportCommun.consMacModele'),
    cleanMac: PSI18N.t('rapportCommun.consCleanMac'),
  };
}
// Meme table de tons que ADVICE_TEXT cote app (lib/imei-advice.ts) : colore
// la phrase de consequence comme les autres conseils graves.
const TON_CONSEQUENCE = { fmiOn: 'danger', mdm: 'danger', mdmIphone: 'danger', blacklist: 'danger', esim: 'danger', macModele: 'warning', fmiUnknown: 'warning', partial: 'warning' };
// Le plus grave l'emporte : un appareil vole mais desimlocke doit annoncer
// le vol, pas la compatibilite SIM. eSIM est une question de compatibilite,
// pas de securite : elle passe apres simlock mais reste devant "infos
// incompletes" et "bon signal" -- sur un appareil par ailleurs sain, c'est
// l'info la plus utile a mettre en avant.
const GRAVITE_CONSEQUENCE = ['fmiOn', 'mdm', 'mdmIphone', 'blacklist', 'macModele', 'fmiUnknown', 'simlock', 'esim', 'partial', 'fmiOffConfirm', 'clean', 'cleanMac'];

function clesConsequence(r) {
  const cles = [];
  if (r.fmiOn === true) cles.push('fmiOn');
  else if (r.fmiOn === null) cles.push('fmiUnknown');
  else cles.push('fmiOffConfirm');
  if (r.mdmOn === true) cles.push(estMac(r) ? 'mdm' : 'mdmIphone');
  if (r.modeleIncoherent === true) cles.push('macModele');
  if (r.blacklisted === true) cles.push('blacklist');
  if (r.simLockStatus === 'locked') cles.push('simlock');
  if (configurationSim(r)?.esimSeuleProbable) cles.push('esim');
  // Un Mac n'a ni IMEI ni liste noire operateur : l'absence de blacklist n'est
  // pas une information manquante, et iCloud desactive sans MDM suffit.
  if (!estMac(r) && r.blacklisted === null) cles.push('partial');
  if (estMac(r)) {
    if (r.fmiOn === false && r.mdmOn !== true) cles.push('cleanMac');
  } else if (r.fmiOn === false && r.blacklisted === false && r.simLockStatus !== 'locked') {
    cles.push('clean');
  }
  return cles;
}

function consequence(r) {
  const cles = clesConsequence(r);
  const cle = GRAVITE_CONSEQUENCE.find(k => cles.includes(k)) ?? cles[0];
  return { texte: CONSEQUENCE()[cle], ton: TON_CONSEQUENCE[cle] };
}

function estOui(valeur) {
  // Préfixe et non valeur exacte : une variante « Yes (…) » reste un signal.
  return /^(yes|oui)\b/i.test(String(valeur ?? '').trim());
}

function statutIcloud(fmiOn) {
  if (fmiOn === true) return 'danger';
  if (fmiOn === false) return 'ok';
  return 'inconnu';
}
function statutBlacklist(blacklisted) {
  if (blacklisted === true) return 'danger';
  if (blacklisted === false) return 'ok';
  return 'inconnu';
}
function statutOperateur(simLockStatus) {
  if (simLockStatus === 'locked') return 'attention';
  if (simLockStatus === 'unlocked') return 'ok';
  return 'inconnu';
}
// "Attention" des qu'un seul signal est positif : un appareil reconditionne
// n'est pas forcement un probleme, mais merite d'etre su avant d'acheter.
function statutHistorique(r) {
  // Une date d'achat impossible n'est pas un simple signal : sans facture,
  // l'acheteur n'a aucun moyen de savoir ce qu'il achete.
  if (dateImpossible(r)) return 'danger';
  // Date estimée dans le futur : une estimation d'Apple, pas une preuve -> à vérifier.
  if (dateFutureASignaler(r)) return 'attention';
  // « Appareil de remplacement » (Replacement Device) : fourni par Apple en echange d'un
  // appareil defectueux, comme la lettre N du numero de modele.
  const champs = [r.refurbished, r.replaced, r.replacementDevice, r.loanerDevice, r.demoUnit];
  if (champs.some(estOui)) return 'attention';
  if (champs.some(v => v !== undefined && v !== null)) return 'ok';
  return 'inconnu';
}
function detailsHistorique(r) {
  const signale = [];
  if (estOui(r.refurbished)) signale.push(PSI18N.t('rapportCommun.histReconditionne'));
  if (estOui(r.replaced)) signale.push(PSI18N.t('rapportCommun.histRemplace'));
  if (estOui(r.replacementDevice)) signale.push(PSI18N.t('rapportCommun.histRemplacement'));
  if (estOui(r.loanerDevice)) signale.push(PSI18N.t('rapportCommun.histPret'));
  if (estOui(r.demoUnit)) signale.push(PSI18N.t('rapportCommun.histDemo'));
  if (dateImpossible(r)) signale.push(PSI18N.t('rapportCommun.histDateImpossible'));
  if (dateFutureASignaler(r)) signale.push(PSI18N.t('rapportCommun.histDateFuture'));
  return signale.length ? PSI18N.t('rapportCommun.histSignaleComme', { liste: signale.join(', ') }) : '';
}

function piliers(r) {
  const histoire = statutHistorique(r);
  const t = PSI18N.t;
  const mac = estMac(r);
  const tous = [
    {
      cle: 'icloud', nom: t('rapportCommun.pilierIcloudNom'), statut: statutIcloud(r.fmiOn),
      etat: r.fmiOn === true ? t('rapportCommun.pilierIcloudEtatActif') : r.fmiOn === false ? t('rapportCommun.pilierIcloudEtatInactif') : t('rapportCommun.pilierEtatNonDisponible'),
      quoi: r.fmiOn === true
        ? t('rapportCommun.pilierIcloudQuoiActif')
        : r.fmiOn === false
          ? t('rapportCommun.pilierIcloudQuoiInactif')
          : t('rapportCommun.pilierIcloudQuoiInconnu'),
    },
    {
      cle: 'blacklist', nom: t('rapportCommun.pilierBlacklistNom'), statut: statutBlacklist(r.blacklisted),
      etat: r.blacklisted === true ? t('rapportCommun.pilierBlacklistEtatSignale') : r.blacklisted === false ? t('rapportCommun.pilierBlacklistEtatNonSignale') : t('rapportCommun.pilierEtatNonDisponible'),
      quoi: r.blacklisted === true
        ? t('rapportCommun.pilierBlacklistQuoiSignale')
        : r.blacklisted === false
          ? t('rapportCommun.pilierBlacklistQuoiNonSignale')
          : t('rapportCommun.pilierQuoiNonDisponible'),
    },
    {
      cle: 'operateur', nom: t('rapportCommun.pilierOperateurNom'), statut: statutOperateur(r.simLockStatus),
      etat: r.simLockStatus === 'locked' ? (r.carrier ? t('rapportCommun.pilierOperateurEtatBloqueSur', { carrier: r.carrier }) : t('rapportCommun.pilierOperateurEtatBloque'))
        : r.simLockStatus === 'unlocked' ? t('rapportCommun.pilierOperateurEtatDesimlocke') : t('rapportCommun.pilierEtatNonDisponible'),
      quoi: r.simLockStatus === 'locked'
        ? t('rapportCommun.pilierOperateurQuoiBloque')
        : r.simLockStatus === 'unlocked'
          // Sans tiroir SIM, « toutes les cartes SIM » contredirait l'alerte eSIM.
          ? t(configurationSim(r)?.esimSeuleProbable ? 'rapportCommun.pilierOperateurQuoiDesimlockeEsim' : 'rapportCommun.pilierOperateurQuoiDesimlocke')
          : t('rapportCommun.pilierQuoiNonDisponible'),
    },
    {
      cle: 'historique', nom: t('rapportCommun.pilierHistoriqueNom'), statut: histoire,
      etat: histoire === 'danger' ? t('rapportCommun.pilierHistoriqueEtatAnormal')
        : histoire === 'attention' ? t('rapportCommun.pilierHistoriqueEtatAttention') : histoire === 'ok' ? t('rapportCommun.pilierHistoriqueEtatOk') : t('rapportCommun.pilierEtatNonDisponible'),
      quoi: histoire === 'danger' || histoire === 'attention' ? detailsHistorique(r)
        : histoire === 'ok' ? t('rapportCommun.pilierHistoriqueQuoiOk')
          : t('rapportCommun.pilierQuoiNonDisponible'),
    },
    {
      cle: 'mdm', nom: t('rapportCommun.pilierMdmNom'),
      statut: r.mdmOn === true ? 'danger' : r.mdmOn === false ? 'ok' : 'inconnu',
      etat: r.mdmOn === true ? t('rapportCommun.pilierMdmEtatActif') : r.mdmOn === false ? t('rapportCommun.pilierMdmEtatInactif') : t('rapportCommun.pilierEtatNonDisponible'),
      quoi: r.mdmOn === true ? t(mac ? 'rapportCommun.pilierMdmQuoiActif' : 'rapportCommun.pilierMdmQuoiActifIphone')
        : r.mdmOn === false ? t('rapportCommun.pilierMdmQuoiInactif')
          : t(mac ? 'rapportCommun.pilierMdmQuoiInconnu' : 'rapportCommun.pilierMdmQuoiInconnuIphone'),
    },
  ];
  return mac
    // Mac : iCloud, MDM, et l'historique seulement si le fournisseur en a donne.
    ? tous.filter(p => p.cle === 'icloud' || (p.cle === 'mdm' && r.mdmOn !== undefined)
      || (p.cle === 'historique' && p.statut !== 'inconnu'))
    // iPhone : le MDM n'apparait que dans un rapport qui le mentionne.
    : tous.filter(p => p.cle !== 'mdm' || r.mdmOn !== undefined);
}

function decompteTexte(liste) {
  const nOk = liste.filter(p => p.statut === 'ok').length;
  const nDanger = liste.filter(p => p.statut === 'danger').length;
  return nDanger > 0
    ? PSI18N.t(nDanger > 1 ? 'rapportCommun.decompteBloquantPlur' : 'rapportCommun.decompteBloquantSing', { n: nDanger })
    : PSI18N.t(nOk > 1 ? 'rapportCommun.decompteOkPlur' : 'rapportCommun.decompteOkSing', { n: nOk, total: liste.length });
}

const SYMBOLE_STATUT = { ok: '✓', attention: '!', danger: '✕', inconnu: '–' };

function pilierHtml(p) {
  return `<div class="pilier pilier-${p.statut}">`
    + '<div class="pilier-haut">'
    + `<span class="pilier-nom">${echapper(p.nom)}</span>`
    + `<span class="pilier-rond pilier-rond-${p.statut}">${SYMBOLE_STATUT[p.statut]}</span>`
    + '</div>'
    + `<div class="pilier-etat">${echapper(p.etat)}</div>`
    + (p.quoi ? `<div class="pilier-quoi">${echapper(p.quoi)}</div>` : '')
    + '</div>';
}

/* ---------- Garantie restante et annonce (25 nov. 2026, comme l'app) ---------- */

/* Fin de la couverture Apple (ISO) : date exacte du texte brut, fin d'AppleCare+
   si plus tardive, sinon durée « Expires In » ajoutée au jour de la vérification.
   null si expirée ou inconnue (lib/valeurs-rapport.ts côté app). */
function finCouverture(r, verifieLe) {
  const candidates = [];
  const exacte = String(r.raw ?? '').match(/repairs?[^\n]*expiration date:\s*(\d{4}-\d{2}-\d{2})/i);
  if (exacte) candidates.push(exacte[1]);
  const ac = String(r.appleCareExpiration ?? '').trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ac)) candidates.push(ac);
  const rep = String(r.repairServiceExpiration ?? '').trim();
  if (!exacte && /^\d{4}-\d{2}-\d{2}/.test(rep)) candidates.push(rep.slice(0, 10));
  if (!candidates.length && verifieLe && /repairs?[^\n]*expires?\s+in/i.test(String(r.raw ?? ''))) {
    const d = { annees: 0, mois: 0, jours: 0 };
    let trouve = false;
    rep.replace(/(\d+)\s*(year|month|day)s?/gi, (_, n, u) => {
      trouve = true;
      const k = u.toLowerCase() === 'year' ? 'annees' : u.toLowerCase() === 'month' ? 'mois' : 'jours';
      d[k] = Number(n);
      return '';
    });
    const base = new Date(verifieLe);
    if (trouve && !isNaN(base.getTime())) {
      candidates.push(new Date(Date.UTC(base.getUTCFullYear() + d.annees, base.getUTCMonth() + d.mois, base.getUTCDate() + d.jours)).toISOString().slice(0, 10));
    }
  }
  return candidates.length ? candidates.sort().pop() : null;
}

/* Temps restant jusqu'à la date ISO : années et mois (jours sous un mois). */
function couvertureRestante(fin) {
  const m = String(fin ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const maintenant = new Date();
  const finJ = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const nowJ = Date.UTC(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  if (finJ <= nowJ) return null;
  let mois = (+m[1] - maintenant.getFullYear()) * 12 + (+m[2] - 1 - maintenant.getMonth());
  if (+m[3] < maintenant.getDate()) mois -= 1;
  if (mois >= 1) return { annees: Math.floor(mois / 12), mois: mois % 12, jours: 0 };
  return { annees: 0, mois: 0, jours: Math.round((finJ - nowJ) / 86400000) };
}

function dureeLisible(d) {
  const t = PSI18N.t;
  const parts = [];
  if (d.annees) parts.push(t(d.annees === 1 ? 'rapportCommun.dureeAn' : 'rapportCommun.dureeAns', { n: d.annees }));
  if (d.mois) parts.push(t('rapportCommun.dureeMois', { n: d.mois }));
  if (d.jours) parts.push(t(d.jours === 1 ? 'rapportCommun.dureeJour' : 'rapportCommun.dureeJours', { n: d.jours }));
  return parts.join(' ');
}

/* « IPHONE 15 PRO MAX,NAUS,256GB » -> « iPhone 15 Pro Max ». */
function modeleLisible(brut) {
  const morceau = String(brut ?? '').split(',').map(s => s.trim()).find(s => /iphone|ipad|macbook|imac/i.test(s))
    || String(brut ?? '').split(',')[0].trim();
  if (!morceau) return '';
  return morceau.toLowerCase().replace(/\b(\w)/g, c => c.toUpperCase())
    .replace(/\bIphone\b/g, 'iPhone').replace(/\bIpad\b/g, 'iPad').replace(/\bMacbook\b/g, 'MacBook').replace(/\bImac\b/g, 'iMac')
    .replace(/\b(\d+)E\b/g, '$1e').replace(/\bSe\b/g, 'SE');
}

/* Texte d'annonce prêt à coller (lib/annonce.ts côté app) : faits du rapport,
   jamais de prix, lien vers le rapport public balisé ?src=annonce. */
function texteAnnonce(r, opts) {
  const t = PSI18N.t;
  const mac = estMac(r);
  const titre = [(mac ? r.modeleApple : null) || modeleLisible(r.model), r.capacity].filter(Boolean).join(' ');
  const lignes = titre ? [titre, ''] : [];
  if (r.fmiOn === false) lignes.push('✅ ' + t('rapportCommun.annIcloud'));
  if (!mac && r.blacklisted === false) lignes.push('✅ ' + t('rapportCommun.annListeNoire'));
  if (mac && r.mdmOn === false) lignes.push('✅ ' + t('rapportCommun.annMdm'));
  if (!mac && r.simLockStatus === 'unlocked') lignes.push('✅ ' + t('rapportCommun.annDebloque'));
  if (!mac && r.simLockStatus === 'locked') lignes.push('🔒 ' + t('rapportCommun.annVerrouille'));
  const sim = configurationSim(r);
  if (sim && sim.esimSeuleProbable) lignes.push('📶 ' + t('rapportCommun.esimUniquement'));
  const reste = couvertureRestante(finCouverture(r, opts.verifieLe));
  if (reste) lignes.push('🛡 ' + t('rapportCommun.garantieRestante', { duree: dureeLisible(reste) }));
  const pays = paysConnu(r.purchaseCountry);
  if (!mac && pays) lignes.push('🌍 ' + t('rapportCommun.annPays', { pays }));
  const id = /^[0-9a-f-]{36}$/i.test(String(opts.checkId ?? '')) ? opts.checkId : null;
  lignes.push('', t('rapportCommun.annPied'), id ? `https://phonescore.app/r/${id}?src=annonce` : 'https://phonescore.app/?src=annonce');
  return lignes.join('\n');
}

/* Bouton « Créer l'annonce » : partage natif sur mobile, sinon copie. Délégué
   au document car le rapport est réécrit à chaque affichage. */
document.addEventListener('click', async (e) => {
  const bouton = e.target.closest && e.target.closest('.btn-annonce');
  if (!bouton) return;
  const texte = bouton.dataset.annonce || '';
  const retour = bouton.parentElement.querySelector('.annonce-retour');
  try {
    if (navigator.share) {
      await navigator.share({ text: texte });
      return;
    }
    await navigator.clipboard.writeText(texte);
    if (retour) { retour.textContent = PSI18N.t('rapportCommun.annCopiee'); retour.classList.remove('hidden'); }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    if (retour) { retour.textContent = texte; retour.classList.remove('hidden'); }
  }
});

/* Grille de quatre controles (verrou iCloud, blacklist, operateur,
   historique) + phrase de consequence, decompte plutot qu'indice sur 100. */
function construireRapportHtml(r, opts = {}) {
  const t = PSI18N.t;
  const sim = configurationSim(r);
  const liste = piliers(r);
  const mac = estMac(r);
  // Date impossible sur un appareil par ailleurs ni verrouille ni vole :
  // bandeau « Reconditionne », comme dans l'app.
  // Seule une date IMPOSSIBLE donne « Reconditionné » ; une date future non.
  const dateSuspecte = dateImpossible(r) && r.fmiOn !== true && r.blacklisted !== true;
  const verdictFinal = dateSuspecte ? 'danger' : verdictAffiche(r);
  const v = dateSuspecte
    ? { titre: t('rapportCommun.verdictReconditionneTitre'), detail: t('rapportCommun.verdictReconditionneDetail') }
    : (LIBELLE()[verdictFinal] ?? LIBELLE().warning);
  // Repli sur le numéro lu chez Sickw (service 54) quand le texte brut n'en a pas.
  const numero = mac ? null : (numeroModeleApple(r.raw) || (r.numeroModele ? { numero: r.numeroModele } : null));
  // Zone de vente d'origine : Apple la publie par numéro de modèle.
  const zone = mac ? null : zoneVente(numero?.numero);
  // Débloqué : l'opérateur d'origine reste lisible dans la politique Apple.
  const origine = !mac && r.simLockStatus === 'unlocked' ? operateurOrigine(r.carrier) : null;
  const fabrication = mac && r.fabricationAnnee
    ? (r.fabricationSemaine ? t('rapportCommun.fabricationSemaine', { semaine: r.fabricationSemaine, annee: r.fabricationAnnee }) : r.fabricationAnnee)
    : '';

  const lignes = [
    ligne(t('rapportCommun.champModele'), (mac ? r.modeleApple : null) ?? r.model),
    ligne(t('rapportCommun.champNumeroModele'), numero ? (numero.identifiant ? `${numero.numero} · ${numero.identifiant}` : numero.numero) : (mac ? r.identifiantModele : '')),
    ligne(t('rapportCommun.champCouleur'), r.color),
    ligne(t('rapportCommun.champCapacite'), r.capacity),
    ligne(t('rapportCommun.champNumeroSerie'), r.serialNumber),
    ligne(t('rapportCommun.champPaysAchat'), paysConnu(r.purchaseCountry)),
    origine ? ligne(t('rapportCommun.champOperateurOrigine'), origine.pays ? `${origine.nom} (${origine.pays})` : origine.nom) : '',
    zone ? ligne(t('rapportCommun.champZoneVente'), t(`rapportCommun.zone_${zone}`)) : '',
    sim ? ligne(t('rapportCommun.champCartesSim'),
      sim.esimSeuleProbable ? t('rapportCommun.esimUniquement') : sim.doubleSim ? t('rapportCommun.doubleSim') : t('rapportCommun.simUnique'),
      sim.esimSeuleProbable ? 'warning' : '') : '',
    ligne(t('rapportCommun.champGarantie'), r.warranty),
    ligne(t('rapportCommun.champDateAchat'), r.estimatedPurchaseDate, dateImpossible(r) ? 'danger' : dateFutureASignaler(r) ? 'warning' : ''),
    /* Activation : manquait sur le site, et dans l'app elle était trop bas pour
       être vue (3 nov. 2026). Juste après la date d'achat, qu'elle explique. */
    ligne(t('rapportCommun.champActivation'), statutActivation(r.activationStatus)),
    ligne(t('rapportCommun.champFinReparations'), r.repairServiceExpiration),
    ligne(t('rapportCommun.champAppleCare'), r.appleCareEligible),
    ligne(t('rapportCommun.champFabrication'), fabrication),
  ].join('');

  const alertes = [
    dateImpossible(r) ? `<div class="avert-sim">${echapper(t('rapportCommun.datePassee'))}</div>`
      : dateFutureASignaler(r) ? `<div class="avert-sim">${echapper(t('rapportCommun.dateFuture'))}</div>` : '',
    r.modeleIncoherent === true && r.modeleApple
      ? `<div class="avert-sim">${echapper(t('rapportCommun.macModeleIncoherent', { apple: r.modeleApple, annonce: r.model ?? '?' }))}</div>` : '',
  ].join('');

  const alerteSim = sim && sim.esimSeuleProbable
    ? `<div class="avert-sim">${echapper(t('rapportCommun.alerteSim'))}</div>`
    : '';

  /* Le verdict vient du serveur, mais il finit dans un attribut : on ne pose
     que l'une des trois valeurs connues, jamais la chaine recue telle quelle. */
  const ton = ['safe', 'warning', 'danger'].includes(verdictFinal) ? verdictFinal : 'warning';

  const barre = liste.map(p => `<span class="decompte-segment decompte-segment-${p.statut}"></span>`).join('');

  // Un avertissement grave (vol, verrou actif, eSIM + risque de lecteur SIM
  // bricole) doit se voir en rouge des la phrase d'accroche, pas seulement
  // plus bas dans la grille.
  const cons = consequence(r);
  const classeConsequence = cons.ton ? ` ${cons.ton}` : '';

  // Garantie restante en avant (argument de vente), sauf date d'achat impossible.
  const fin = dateImpossible(r) ? null : finCouverture(r, opts.verifieLe);
  const reste = couvertureRestante(fin);
  const blocGarantie = reste
    ? `<div class="garantie-restante"><b>🛡 ${echapper(t('rapportCommun.garantieRestante', { duree: dureeLisible(reste) }))}</b>`
      + `<span>${echapper(t('rapportCommun.garantieRestanteSub', { date: new Date(fin + 'T12:00:00').toLocaleDateString(document.documentElement.lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }))}</span></div>`
    : '';
  // Annonce prête à coller : seulement pour un appareil qui peut se vendre.
  const blocAnnonce = verdictFinal !== 'danger'
    ? `<div class="annonce"><button type="button" class="btn-annonce" data-annonce="${echapper(texteAnnonce(r, opts))}">📣 ${echapper(t('rapportCommun.annBouton'))}</button>`
      + `<p class="annonce-retour hidden"></p></div>`
    : '';

  return `<div class="verdict ${ton}"><b>${v.titre}</b><span>${v.detail}</span></div>`
    + `<p class="consequence${classeConsequence}">${echapper(cons.texte)}</p>`
    + blocGarantie
    + `<div class="decompte"><div class="decompte-barre">${barre}</div>`
    + `<span class="decompte-texte">${decompteTexte(liste)}</span></div>`
    + `<div class="grille">${liste.map(pilierHtml).join('')}</div>`
    + alertes + `<dl>${lignes}</dl>${alerteSim}`
    + blocAnnonce
    + `<p class="offre-parrainage">${echapper(t('rapportCommun.offreParrainage'))}</p>`;
}

/** Rend le rapport `r` dans l'element `id` et le fait apparaitre. */
function afficherRapportDans(id, r, opts = {}) {
  const conteneur = document.getElementById(id);
  conteneur.innerHTML = construireRapportHtml(r, opts);
  conteneur.classList.remove('hidden');
  conteneur.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
