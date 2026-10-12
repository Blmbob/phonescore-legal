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

function ligne(cle, valeur, ton) {
  if (valeur === undefined || valeur === null || valeur === '') return '';
  const classe = ton ? ` class="${ton}"` : '';
  return `<dt>${cle}</dt><dd${classe}>${echapper(valeur)}</dd>`;
}

/* Configuration SIM — meme regle que l'application (lib/sim-config.ts).

   Un iPhone achete aux Etats-Unis depuis l'iPhone 14 n'a aucun tiroir SIM et ne
   fonctionne qu'en eSIM. Revendu ici a un acheteur dont l'operateur ne propose
   pas l'eSIM, l'appareil est inutilisable.

   IMEI2 est la donnee sure : un second IMEI prouve deux lignes. La forme exacte
   de ces deux lignes (nano + eSIM, double eSIM, double nano) depend de la
   reference regionale, que Sickw ne fournit pas : elle n'est pas deduite.

   Le critere est le PAYS D'ACHAT et non le code region du modele : NAJP couvre
   l'Amerique du Nord ET le Japon, or les iPhone japonais ont garde leur tiroir. */
const PREMIERE_GENERATION_SANS_TIROIR = 14;

function generationIphone(modele) {
  const m = String(modele || '').trim().match(/^IPHONE[ ]+([0-9]{1,2})/i);
  return m ? Number(m[1]) : null;
}

function estEtatsUnis(pays) {
  const p = String(pays || '').trim().toLowerCase();
  return p === 'us' || p === 'usa'
    || p.startsWith('united states')
    || p.startsWith('etats-unis') || p.startsWith('etats unis')
    || p.startsWith('états-unis') || p.startsWith('états unis');
}

function configurationSim(r) {
  if (r.deviceFamily && r.deviceFamily !== 'iphone') return null;

  const generation = generationIphone(r.model);
  const doubleSim = typeof r.imei2 === 'string' && r.imei2.trim() !== '';
  const esimSeuleProbable = estEtatsUnis(r.purchaseCountry)
    && generation !== null
    && generation >= PREMIERE_GENERATION_SANS_TIROIR;

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
  return /^(yes|oui)$/i.test(String(valeur ?? '').trim());
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
  if (problemeDateAchat(r.estimatedPurchaseDate)) return 'danger';
  const champs = [r.refurbished, r.replaced, r.loanerDevice, r.demoUnit];
  if (champs.some(estOui)) return 'attention';
  if (champs.some(v => v !== undefined && v !== null)) return 'ok';
  return 'inconnu';
}
function detailsHistorique(r) {
  const signale = [];
  if (estOui(r.refurbished)) signale.push(PSI18N.t('rapportCommun.histReconditionne'));
  if (estOui(r.replaced)) signale.push(PSI18N.t('rapportCommun.histRemplace'));
  if (estOui(r.loanerDevice)) signale.push(PSI18N.t('rapportCommun.histPret'));
  if (estOui(r.demoUnit)) signale.push(PSI18N.t('rapportCommun.histDemo'));
  if (problemeDateAchat(r.estimatedPurchaseDate)) signale.push(PSI18N.t('rapportCommun.histDateImpossible'));
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
          ? t('rapportCommun.pilierOperateurQuoiDesimlocke')
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

/* Grille de quatre controles (verrou iCloud, blacklist, operateur,
   historique) + phrase de consequence, decompte plutot qu'indice sur 100. */
function construireRapportHtml(r) {
  const t = PSI18N.t;
  const sim = configurationSim(r);
  const liste = piliers(r);
  const mac = estMac(r);
  const probleme = problemeDateAchat(r.estimatedPurchaseDate);
  // Date impossible sur un appareil par ailleurs ni verrouille ni vole :
  // bandeau « Reconditionne », comme dans l'app.
  const dateSuspecte = probleme !== null && r.fmiOn !== true && r.blacklisted !== true;
  const verdictFinal = dateSuspecte ? 'danger' : verdictAffiche(r);
  const v = dateSuspecte
    ? { titre: t('rapportCommun.verdictReconditionneTitre'), detail: t('rapportCommun.verdictReconditionneDetail') }
    : (LIBELLE()[verdictFinal] ?? LIBELLE().warning);
  const numero = mac ? null : numeroModeleApple(r.raw);
  const fabrication = mac && r.fabricationAnnee
    ? (r.fabricationSemaine ? t('rapportCommun.fabricationSemaine', { semaine: r.fabricationSemaine, annee: r.fabricationAnnee }) : r.fabricationAnnee)
    : '';

  const lignes = [
    ligne(t('rapportCommun.champModele'), (mac ? r.modeleApple : null) ?? r.model),
    ligne(t('rapportCommun.champNumeroModele'), numero ? (numero.identifiant ? `${numero.numero} · ${numero.identifiant}` : numero.numero) : (mac ? r.identifiantModele : '')),
    ligne(t('rapportCommun.champCouleur'), r.color),
    ligne(t('rapportCommun.champCapacite'), r.capacity),
    ligne(t('rapportCommun.champNumeroSerie'), r.serialNumber),
    ligne(t('rapportCommun.champPaysAchat'), r.purchaseCountry),
    sim ? ligne(t('rapportCommun.champCartesSim'), sim.doubleSim ? t('rapportCommun.doubleSim') : t('rapportCommun.simUnique')) : '',
    ligne(t('rapportCommun.champGarantie'), r.warranty),
    ligne(t('rapportCommun.champDateAchat'), r.estimatedPurchaseDate, probleme ? 'danger' : ''),
    ligne(t('rapportCommun.champFinReparations'), r.repairServiceExpiration),
    ligne(t('rapportCommun.champAppleCare'), r.appleCareEligible),
    ligne(t('rapportCommun.champFabrication'), fabrication),
  ].join('');

  const alertes = [
    probleme ? `<div class="avert-sim">${echapper(t(probleme === 'future' ? 'rapportCommun.dateFuture' : 'rapportCommun.datePassee'))}</div>` : '',
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

  return `<div class="verdict ${ton}"><b>${v.titre}</b><span>${v.detail}</span></div>`
    + `<p class="consequence${classeConsequence}">${echapper(cons.texte)}</p>`
    + `<div class="decompte"><div class="decompte-barre">${barre}</div>`
    + `<span class="decompte-texte">${decompteTexte(liste)}</span></div>`
    + `<div class="grille">${liste.map(pilierHtml).join('')}</div>`
    + alertes + `<dl>${lignes}</dl>${alerteSim}`;
}

/** Rend le rapport `r` dans l'element `id` et le fait apparaitre. */
function afficherRapportDans(id, r) {
  const conteneur = document.getElementById(id);
  conteneur.innerHTML = construireRapportHtml(r);
  conteneur.classList.remove('hidden');
  conteneur.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
