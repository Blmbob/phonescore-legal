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
  };
}
// Meme table de tons que ADVICE_TEXT cote app (lib/imei-advice.ts) : colore
// la phrase de consequence comme les autres conseils graves.
const TON_CONSEQUENCE = { fmiOn: 'danger', blacklist: 'danger', esim: 'danger', fmiUnknown: 'warning', partial: 'warning' };
// Le plus grave l'emporte : un appareil vole mais desimlocke doit annoncer
// le vol, pas la compatibilite SIM. eSIM est une question de compatibilite,
// pas de securite : elle passe apres simlock mais reste devant "infos
// incompletes" et "bon signal" -- sur un appareil par ailleurs sain, c'est
// l'info la plus utile a mettre en avant.
const GRAVITE_CONSEQUENCE = ['fmiOn', 'blacklist', 'fmiUnknown', 'simlock', 'esim', 'partial', 'fmiOffConfirm', 'clean'];

function clesConsequence(r) {
  const cles = [];
  if (r.fmiOn === true) cles.push('fmiOn');
  else if (r.fmiOn === null) cles.push('fmiUnknown');
  else cles.push('fmiOffConfirm');
  if (r.blacklisted === true) cles.push('blacklist');
  if (r.simLockStatus === 'locked') cles.push('simlock');
  if (configurationSim(r)?.esimSeuleProbable) cles.push('esim');
  if (r.blacklisted === null) cles.push('partial');
  if (r.fmiOn === false && r.blacklisted === false && r.simLockStatus !== 'locked') cles.push('clean');
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
  return signale.length ? PSI18N.t('rapportCommun.histSignaleComme', { liste: signale.join(', ') }) : '';
}

function piliers(r) {
  const histoire = statutHistorique(r);
  const t = PSI18N.t;
  return [
    {
      nom: t('rapportCommun.pilierIcloudNom'), statut: statutIcloud(r.fmiOn),
      etat: r.fmiOn === true ? t('rapportCommun.pilierIcloudEtatActif') : r.fmiOn === false ? t('rapportCommun.pilierIcloudEtatInactif') : t('rapportCommun.pilierEtatNonDisponible'),
      quoi: r.fmiOn === true
        ? t('rapportCommun.pilierIcloudQuoiActif')
        : r.fmiOn === false
          ? t('rapportCommun.pilierIcloudQuoiInactif')
          : t('rapportCommun.pilierIcloudQuoiInconnu'),
    },
    {
      nom: t('rapportCommun.pilierBlacklistNom'), statut: statutBlacklist(r.blacklisted),
      etat: r.blacklisted === true ? t('rapportCommun.pilierBlacklistEtatSignale') : r.blacklisted === false ? t('rapportCommun.pilierBlacklistEtatNonSignale') : t('rapportCommun.pilierEtatNonDisponible'),
      quoi: r.blacklisted === true
        ? t('rapportCommun.pilierBlacklistQuoiSignale')
        : r.blacklisted === false
          ? t('rapportCommun.pilierBlacklistQuoiNonSignale')
          : t('rapportCommun.pilierQuoiNonDisponible'),
    },
    {
      nom: t('rapportCommun.pilierOperateurNom'), statut: statutOperateur(r.simLockStatus),
      etat: r.simLockStatus === 'locked' ? (r.carrier ? t('rapportCommun.pilierOperateurEtatBloqueSur', { carrier: r.carrier }) : t('rapportCommun.pilierOperateurEtatBloque'))
        : r.simLockStatus === 'unlocked' ? t('rapportCommun.pilierOperateurEtatDesimlocke') : t('rapportCommun.pilierEtatNonDisponible'),
      quoi: r.simLockStatus === 'locked'
        ? t('rapportCommun.pilierOperateurQuoiBloque')
        : r.simLockStatus === 'unlocked'
          ? t('rapportCommun.pilierOperateurQuoiDesimlocke')
          : t('rapportCommun.pilierQuoiNonDisponible'),
    },
    {
      nom: t('rapportCommun.pilierHistoriqueNom'), statut: histoire,
      etat: histoire === 'attention' ? t('rapportCommun.pilierHistoriqueEtatAttention') : histoire === 'ok' ? t('rapportCommun.pilierHistoriqueEtatOk') : t('rapportCommun.pilierEtatNonDisponible'),
      quoi: histoire === 'attention' ? detailsHistorique(r)
        : histoire === 'ok' ? t('rapportCommun.pilierHistoriqueQuoiOk')
          : t('rapportCommun.pilierQuoiNonDisponible'),
    },
  ];
}

function decompteTexte(liste) {
  const nOk = liste.filter(p => p.statut === 'ok').length;
  const nDanger = liste.filter(p => p.statut === 'danger').length;
  return nDanger > 0
    ? PSI18N.t(nDanger > 1 ? 'rapportCommun.decompteBloquantPlur' : 'rapportCommun.decompteBloquantSing', { n: nDanger })
    : PSI18N.t(nOk > 1 ? 'rapportCommun.decompteOkPlur' : 'rapportCommun.decompteOkSing', { n: nOk });
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
  const v = LIBELLE()[r.verdict] ?? LIBELLE().warning;
  const sim = configurationSim(r);
  const liste = piliers(r);

  const lignes = [
    ligne(t('rapportCommun.champModele'), r.model),
    ligne(t('rapportCommun.champCapacite'), r.capacity),
    ligne(t('rapportCommun.champNumeroSerie'), r.serialNumber),
    ligne(t('rapportCommun.champPaysAchat'), r.purchaseCountry),
    sim ? ligne(t('rapportCommun.champCartesSim'), sim.doubleSim ? t('rapportCommun.doubleSim') : t('rapportCommun.simUnique')) : '',
    ligne(t('rapportCommun.champGarantie'), r.warranty),
  ].join('');

  const alerteSim = sim && sim.esimSeuleProbable
    ? `<div class="avert-sim">${echapper(t('rapportCommun.alerteSim'))}</div>`
    : '';

  /* Le verdict vient du serveur, mais il finit dans un attribut : on ne pose
     que l'une des trois valeurs connues, jamais la chaine recue telle quelle. */
  const ton = ['safe', 'warning', 'danger'].includes(r.verdict) ? r.verdict : 'warning';

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
    + `<dl>${lignes}</dl>${alerteSim}`;
}

/** Rend le rapport `r` dans l'element `id` et le fait apparaitre. */
function afficherRapportDans(id, r) {
  const conteneur = document.getElementById(id);
  conteneur.innerHTML = construireRapportHtml(r);
  conteneur.classList.remove('hidden');
  conteneur.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
