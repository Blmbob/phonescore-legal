/* Sorti de index.html pour que la CSP puisse refuser le script en ligne.
   Ne pas remettre ce code dans la page : script-src vaut 'self'. */
const { createClient } = window.supabase;

// Cle publique : sans danger cote client (protegee par RLS cote base).
const SUPABASE_URL = "https://bvriicetjcnxrbhelokh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_p35a312TC0qA8YDdw_fWAQ_b0AUrfqf";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = id => document.getElementById(id);
let type = 'iphone';

function afficher(el, texte, classe) {
  el.textContent = texte;
  el.className = 'msg ' + classe;
}
function effacer(el) { el.textContent = ''; el.className = 'msg'; }

function occupe(bouton, actif, libelle) {
  bouton.disabled = actif;
  bouton.innerHTML = actif ? '<span class="spin"></span>' : libelle;
}

/* ---------------- session ---------------- */

supabase.auth.onAuthStateChange((_evt, session) => rendre(session));
supabase.auth.getSession().then(({ data }) => rendre(data.session));

async function rendre(session) {
  if (session) {
    $('vue-auth').classList.add('hidden');
    $('vue-app').classList.remove('hidden');
    $('courriel').textContent = session.user.email ?? '';
    await rafraichirSolde();
    rafraichirStats();
    chargerHistorique(true);
  } else {
    $('vue-app').classList.add('hidden');
    $('vue-auth').classList.remove('hidden');
    // Efface la liste pour qu'une session suivante, sur le meme appareil, ne
    // parte pas d'un historique deja rempli avant son propre chargement.
    $('historique-liste').innerHTML = '';
    $('historique-vide').classList.add('hidden');
    $('historique-plus').classList.add('hidden');
    decalageHistorique = 0;
    historiqueTermine = false;
  }
}

async function rafraichirSolde() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  // La RLS restreint deja a la ligne de l'utilisateur, mais filtrer
  // explicitement evite un `single()` en echec si une policy evolue.
  const { data } = await supabase
    .from('profiles').select('pieces').eq('id', session.user.id).maybeSingle();
  $('solde').textContent = data ? data.pieces : '—';
}

/* ---------------- authentification ---------------- */

$('btn-connexion').addEventListener('click', async () => {
  const email = $('email').value.trim().toLowerCase();
  const password = $('mdp').value;
  if (!email || !password) return afficher($('msg-auth'), 'Renseignez votre e-mail et votre mot de passe.', 'err');

  occupe($('btn-connexion'), true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  occupe($('btn-connexion'), false, 'Se connecter');
  if (error) afficher($('msg-auth'), 'Connexion refusée. Vérifiez vos identifiants.', 'err');
});

// `occupe()` remplace tout le contenu du bouton par le libelle donne : garder
// l'icone sous la main pour la restaurer si la tentative echoue, plutot que
// de laisser le bouton perdre son logo Apple apres une erreur.
const CONTENU_BTN_APPLE = $('btn-apple').innerHTML;

$('btn-apple').addEventListener('click', async () => {
  effacer($('msg-auth'));
  occupe($('btn-apple'), true);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: 'https://phonescore.app/' },
  });
  // Pas de reactivation du bouton en cas de succes : la page part vers Apple.
  if (error) {
    occupe($('btn-apple'), false, CONTENU_BTN_APPLE);
    afficher($('msg-auth'), "La connexion avec Apple n'a pas pu démarrer. Réessayez dans un instant.", 'err');
  }
});

$('btn-inscription').addEventListener('click', async () => {
  const email = $('email').value.trim().toLowerCase();
  const password = $('mdp').value;
  if (password.length < 8) return afficher($('msg-auth'), 'Le mot de passe doit contenir au moins 8 caractères.', 'err');
  if (password !== $('mdp-confirmation').value) return afficher($('msg-auth'), 'Les mots de passe ne correspondent pas.', 'err');

  occupe($('btn-inscription'), true);
  const { data, error } = await supabase.auth.signUp({ email, password });
  occupe($('btn-inscription'), false, 'Créer un compte');

  if (error) return afficher($('msg-auth'), "Inscription impossible. Cette adresse est peut-être déjà utilisée.", 'err');
  // Selon le reglage de confirmation d'e-mail, la session peut etre nulle.
  if (!data.session) afficher($('msg-auth'), 'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.', 'ok');
});

/* Trois comptages serveur : aucune ligne transferee, seulement des totaux.
   Independants, donc allSettled — un chiffre manquant ne doit pas effacer les
   deux autres. */
async function rafraichirStats() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const uid = session.user.id;

  const debutDuJour = new Date();
  debutDuJour.setHours(0, 0, 0, 0);

  const compter = () => supabase.from('checks')
    .select('id', { count: 'exact', head: true }).eq('user_id', uid);

  const [jour, total, sains] = await Promise.allSettled([
    compter().gte('created_at', debutDuJour.toISOString()),
    compter(),
    compter().eq('verdict', 'safe'),
  ]);

  if (jour.status === 'fulfilled') $('stat-jour').textContent = jour.value.count ?? 0;

  if (total.status === 'fulfilled' && sains.status === 'fulfilled') {
    const n = total.value.count ?? 0;
    $('stat-total').textContent = n;

    const bloc = $('stat-fiable');
    if (n === 0) {
      $('stat-fiable-valeur').textContent = '—';
      bloc.dataset.ton = 'neutral';
      return;
    }
    const taux = Math.round(((sains.value.count ?? 0) / n) * 100);
    $('stat-fiable-valeur').textContent = taux + '%';
    bloc.dataset.ton = taux >= 70 ? 'good' : taux >= 40 ? 'warn' : 'bad';
  }
}

/* ---------------- historique ---------------- */

const TAILLE_PAGE_HISTORIQUE = 10;
let decalageHistorique = 0;
let historiqueTermine = false;

function ilYA(iso) {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return "à l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffJ = Math.floor(diffH / 24);
  if (diffJ < 30) return `il y a ${diffJ} j`;
  const diffMois = Math.floor(diffJ / 30);
  return `il y a ${diffMois} mois`;
}

function masquer(valeur) {
  if (!valeur || valeur.length <= 4) return valeur || '';
  return '•'.repeat(valeur.length - 4) + valeur.slice(-4);
}

async function chargerHistorique(reinitialiser) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  if (reinitialiser) {
    decalageHistorique = 0;
    historiqueTermine = false;
    $('historique-liste').innerHTML = '';
  }
  if (historiqueTermine) return;

  $('historique-plus').disabled = true;
  const { data, error } = await supabase
    .from('checks')
    .select('id, device_type, imei_or_serial, verdict, report_data, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .range(decalageHistorique, decalageHistorique + TAILLE_PAGE_HISTORIQUE - 1);
  $('historique-plus').disabled = false;

  if (error || !data) return;

  if (decalageHistorique === 0 && data.length === 0) {
    $('historique-vide').classList.remove('hidden');
    return;
  }
  $('historique-vide').classList.add('hidden');

  decalageHistorique += data.length;
  // Une page pleine signifie qu'il y en a peut-etre d'autres ; une page
  // incomplete signifie qu'on a atteint le bout (meme logique que l'app).
  historiqueTermine = data.length < TAILLE_PAGE_HISTORIQUE;
  $('historique-plus').classList.toggle('hidden', historiqueTermine);

  for (const item of data) {
    const ton = ['safe', 'warning', 'danger'].includes(item.verdict) ? item.verdict : 'warning';
    const div = document.createElement('div');
    div.className = 'hist-item';
    div.innerHTML =
      `<span class="hist-point hist-${ton}"></span>`
      + '<div class="hist-corps">'
      + `<span class="hist-modele">${echapper(item.report_data?.model || (item.device_type === 'iphone' ? 'iPhone' : 'MacBook'))}</span>`
      + `<span class="hist-meta">${echapper(masquer(item.imei_or_serial))} · ${ilYA(item.created_at)}</span>`
      + '</div>';
    div.addEventListener('click', () => afficherRapport(item.report_data));
    $('historique-liste').appendChild(div);
  }
}

$('historique-plus').addEventListener('click', () => chargerHistorique(false));

/* ---------------- verification ---------------- */

for (const [id, valeur] of [['t-iphone', 'iphone'], ['t-macbook', 'macbook']]) {
  $(id).addEventListener('click', () => {
    type = valeur;
    $('t-iphone').setAttribute('aria-pressed', String(valeur === 'iphone'));
    $('t-macbook').setAttribute('aria-pressed', String(valeur === 'macbook'));
  });
}

// Les edge functions renvoient un message utile dans le corps meme en erreur ;
// supabase-js ne l'expose que via error.context.
async function messageErreur(error, defaut) {
  try {
    const corps = await error?.context?.json();
    if (corps?.message) return corps.message;
  } catch { /* corps illisible : on garde le message par defaut */ }
  return defaut;
}

$('btn-verifier').addEventListener('click', async () => {
  const imei = $('imei').value.trim();
  effacer($('msg-verif'));
  $('rapport').classList.add('hidden');

  if (imei.length < 8) return afficher($('msg-verif'), 'Saisissez un IMEI ou un numéro de série valide.', 'err');

  occupe($('btn-verifier'), true);
  const { data, error } = await supabase.functions.invoke('check-imei', { body: { imei, type } });
  occupe($('btn-verifier'), false, 'Vérifier maintenant');

  if (error) {
    return afficher($('msg-verif'), await messageErreur(error, "La vérification n'a pas pu aboutir. Réessayez dans un instant."), 'err');
  }
  if (!data?.success) {
    return afficher($('msg-verif'), data?.message || 'Appareil introuvable.', 'err');
  }

  await rafraichirSolde();
  afficherRapport(data.report);
});

const LIBELLE = {
  safe:    { titre: 'Appareil sûr', detail: 'Aucun blocage détecté.' },
  warning: { titre: 'Prudence', detail: 'Des points demandent votre attention.' },
  danger:  { titre: 'Ne pas acheter', detail: 'Cet appareil présente un blocage.' },
};

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

/* Grille de quatre controles (verrou iCloud, blacklist, operateur,
   historique) + phrase de consequence, en remplacement de la liste plate.
   Doublon volontaire de lib/imei-advice.ts et de la logique de
   components/imei-report.tsx cote app : ce site est du JS brut sans etape de
   build, donc pas d'import possible depuis le depot phonescore54. Ne garder
   que les libelles COURTS ("short") : la version longue ("full") depend de
   l'appareil (iPhone/iPad/Mac/Watch) et n'est affichee nulle part ici. */
const CONSEQUENCE = {
  fmiOn: "Verrou d'activation ACTIF — n'achète pas avant déconnexion du vendeur.",
  fmiUnknown: "Verrou non confirmé — vérifie sur l'appareil (Réglages → Localiser).",
  fmiOffConfirm: "Confirme sur l'appareil que Localiser est désactivé.",
  blacklist: "N'achète pas : appareil déclaré volé ou perdu.",
  simlock: "Bloqué à l'étranger — vérifie la compatibilité SIM.",
  clean: "Bon signal — vérifie aussi l'état physique.",
  partial: 'Infos incomplètes — redouble de prudence.',
};
// Le plus grave l'emporte : un appareil volé mais desimlocke doit annoncer
// le vol, pas la compatibilite SIM.
const GRAVITE_CONSEQUENCE = ['fmiOn', 'blacklist', 'fmiUnknown', 'simlock', 'partial', 'fmiOffConfirm', 'clean'];

function clesConsequence(r) {
  const cles = [];
  if (r.fmiOn === true) cles.push('fmiOn');
  else if (r.fmiOn === null) cles.push('fmiUnknown');
  else cles.push('fmiOffConfirm');
  if (r.blacklisted === true) cles.push('blacklist');
  if (r.simLockStatus === 'locked') cles.push('simlock');
  if (r.blacklisted === null) cles.push('partial');
  if (r.fmiOn === false && r.blacklisted === false && r.simLockStatus !== 'locked') cles.push('clean');
  return cles;
}

function consequence(r) {
  const cles = clesConsequence(r);
  const cle = GRAVITE_CONSEQUENCE.find(k => cles.includes(k)) ?? cles[0];
  return CONSEQUENCE[cle];
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
  if (estOui(r.refurbished)) signale.push('reconditionné');
  if (estOui(r.replaced)) signale.push('remplacé');
  if (estOui(r.loanerDevice)) signale.push('appareil de prêt');
  if (estOui(r.demoUnit)) signale.push('appareil de démo');
  return signale.length ? `Signalé comme : ${signale.join(', ')}.` : '';
}

function piliers(r) {
  const histoire = statutHistorique(r);
  return [
    {
      nom: 'Verrou iCloud', statut: statutIcloud(r.fmiOn),
      etat: r.fmiOn === true ? 'Activé' : r.fmiOn === false ? 'Désactivé' : 'Non disponible',
      quoi: r.fmiOn === true
        ? "Le compte du vendeur verrouille l'appareil."
        : r.fmiOn === false
          ? "S'active sans le compte du vendeur."
          : 'Vérifie directement sur l\'appareil.',
    },
    {
      nom: 'Vol / blacklist', statut: statutBlacklist(r.blacklisted),
      etat: r.blacklisted === true ? 'Signalé' : r.blacklisted === false ? 'Non signalé' : 'Non disponible',
      quoi: r.blacklisted === true
        ? 'Peut être coupé du réseau à tout moment.'
        : r.blacklisted === false
          ? 'Aucune déclaration de perte ou de vol.'
          : "Le fournisseur n'a rien renvoyé sur ce point.",
    },
    {
      nom: 'Opérateur', statut: statutOperateur(r.simLockStatus),
      etat: r.simLockStatus === 'locked' ? `Bloqué${r.carrier ? ` sur ${r.carrier}` : ''}`
        : r.simLockStatus === 'unlocked' ? 'Désimlocké' : 'Non disponible',
      quoi: r.simLockStatus === 'locked'
        ? "Vérifie qu'il accepte une carte SIM locale."
        : r.simLockStatus === 'unlocked'
          ? 'Fonctionne avec toutes les cartes SIM.'
          : "Le fournisseur n'a rien renvoyé sur ce point.",
    },
    {
      nom: 'Historique', statut: histoire,
      etat: histoire === 'attention' ? 'À vérifier' : histoire === 'ok' ? 'Rien à signaler' : 'Non disponible',
      quoi: histoire === 'attention' ? detailsHistorique(r)
        : histoire === 'ok' ? 'Ni reconditionné, ni remplacé, ni prêt ou démo.'
          : "Le fournisseur n'a rien renvoyé sur ce point.",
    },
  ];
}

function decompteTexte(liste) {
  const nOk = liste.filter(p => p.statut === 'ok').length;
  const nDanger = liste.filter(p => p.statut === 'danger').length;
  return nDanger > 0
    ? `${nDanger} contrôle${nDanger > 1 ? 's' : ''} bloquant${nDanger > 1 ? 's' : ''}`
    : `${nOk} contrôle${nOk > 1 ? 's' : ''} sur 4 au vert`;
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

function afficherRapport(r) {
  const v = LIBELLE[r.verdict] ?? LIBELLE.warning;
  const sim = configurationSim(r);
  const liste = piliers(r);

  const lignes = [
    ligne('Modèle', r.model),
    ligne('Capacité', r.capacity),
    ligne('Numéro de série', r.serialNumber),
    ligne('Pays d\'achat', r.purchaseCountry),
    sim ? ligne('Cartes SIM', sim.doubleSim ? 'Double SIM (deux lignes)' : 'SIM unique') : '',
    ligne('Garantie', r.warranty),
  ].join('');

  const alerteSim = sim && sim.esimSeuleProbable
    ? '<div class="avert-sim">Modèle vendu aux États-Unis : depuis l’iPhone 14, ces '
      + 'appareils n’ont pas de tiroir SIM et fonctionnent uniquement en eSIM. '
      + 'Vérifiez que votre opérateur propose l’eSIM avant d’acheter.</div>'
    : '';

  /* Le verdict vient du serveur, mais il finit dans un attribut : on ne pose
     que l'une des trois valeurs connues, jamais la chaine recue telle quelle. */
  const ton = ['safe', 'warning', 'danger'].includes(r.verdict) ? r.verdict : 'warning';

  const barre = liste.map(p => `<span class="decompte-segment decompte-segment-${p.statut}"></span>`).join('');

  $('rapport').innerHTML =
    `<div class="verdict ${ton}"><b>${v.titre}</b><span>${v.detail}</span></div>`
    + `<p class="consequence">${echapper(consequence(r))}</p>`
    + `<div class="decompte"><div class="decompte-barre">${barre}</div>`
    + `<span class="decompte-texte">${decompteTexte(liste)}</span></div>`
    + `<div class="grille">${liste.map(pilierHtml).join('')}</div>`
    + `<dl>${lignes}</dl>${alerteSim}`;
  $('rapport').classList.remove('hidden');
  $('rapport').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
