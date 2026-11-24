/* Sorti de index.html pour que la CSP puisse refuser le script en ligne.
   Ne pas remettre ce code dans la page : script-src vaut 'self'. */
const { createClient } = window.supabase;

// Cle publique : sans danger cote client (protegee par RLS cote base).
const SUPABASE_URL = "https://bvriicetjcnxrbhelokh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_p35a312TC0qA8YDdw_fWAQ_b0AUrfqf";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = id => document.getElementById(id);
let type = 'iphone';
// Niveau MacBook : 'standard' (2 pieces) ou 'complet' (4 pieces).
let niveau = 'standard';
// Dernier solde lu (null tant qu'inconnu) : choisit ou mene « Debloquer ».
let soldeActuel = null;

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

// Marque le compte comme venant du site, une seule fois : le filtre
// `is('signup_source', null)` fait qu'un compte déjà tagué 'app' (créé
// depuis le mobile, puis connecté ici) n'est jamais écrasé. Même logique
// côté app dans contexts/auth-context.tsx (tagSignupSource).
async function marquerOrigineWeb(userId) {
  const { error } = await supabase
    .from('profiles').update({ signup_source: 'web' })
    .eq('id', userId).is('signup_source', null);
  if (error) console.warn('marquerOrigineWeb error', error.message);
}

// Campagne d'origine (voir js/menu.js) : la fonction serveur n'ecrit qu'une fois.
function marquerCampagneWeb() {
  let c = null;
  try { c = localStorage.getItem('ps_campaign'); } catch (e) {}
  if (!c) return;
  supabase.rpc('set_signup_campaign', { p_campaign: c }).then(() => {}, () => {});
}

// Meme logique write-once que marquerOrigineWeb, pour le pays. cf-ipcountry
// n'atteint jamais le JS client (c'est un en-tete de la requete, pas une
// donnee exposee au navigateur) : /geo (functions/geo.js, une fonction
// Cloudflare Pages) le relaie. Cote app, contexts/auth-context.tsx pose la
// meme colonne via Localization.getLocales() -- un reglage appareil, pas une
// geoloc IP comme ici.
async function marquerPaysWeb(userId) {
  let country;
  try {
    country = (await (await fetch('/geo')).json()).country;
  } catch (e) {
    return console.warn('marquerPaysWeb fetch error', e.message);
  }
  if (!country) return;
  const { error } = await supabase
    .from('profiles').update({ signup_country: country })
    .eq('id', userId).is('signup_country', null);
  if (error) console.warn('marquerPaysWeb error', error.message);
}

/* Question « Comment as-tu connu PhoneScore ? » : la plupart des comptes se creent ici, et
   sans lien balise (?src=) ni site d'origine, rien ne dit d'ou ils viennent. Posee aux comptes
   connectes sans origine ; une touche suffit, « Plus tard » la repose deux fois au plus.
   Meme principe que components/question-source.tsx cote app, avec le prefixe « web- ». */
const CLE_QUESTION_SOURCE = 'ps_question_source';
const SOURCES_QUESTION = ['facebook', 'tiktok', 'whatsapp', 'instagram', 'ami', 'appstore', 'google', 'autre'];

async function proposerQuestionSource(userId) {
  const bloc = $('question-source');
  if (!bloc) return;
  let etat = null;
  try {
    etat = localStorage.getItem(CLE_QUESTION_SOURCE);
    // Une campagne gardee par js/menu.js part au serveur a la connexion : pas de question.
    if (localStorage.getItem('ps_campaign')) return;
  } catch (e) { return; }
  const reports = etat && etat.startsWith('plus-tard-') ? Number(etat.slice(10)) || 0 : 0;
  if (etat && (!etat.startsWith('plus-tard-') || reports > 2)) return;
  const { data, error } = await supabase.from('profiles').select('signup_campaign').eq('id', userId).maybeSingle();
  if (error || !data || data.signup_campaign) return;

  const fermer = valeur => {
    bloc.classList.add('hidden');
    try { localStorage.setItem(CLE_QUESTION_SOURCE, valeur); } catch (e) {}
  };
  bloc.querySelectorAll('.qs-choix').forEach(bouton => {
    bouton.onclick = () => {
      const source = bouton.getAttribute('data-source');
      if (!SOURCES_QUESTION.includes(source)) return;
      supabase.rpc('set_signup_campaign', { p_campaign: 'web-' + source }).then(() => {}, () => {});
      fermer(source);
    };
  });
  $('qs-plus-tard').onclick = () => fermer('plus-tard-' + (reports + 1));
  bloc.classList.remove('hidden');
}

/* Parrainage (18 nov. 2026, meme regle que l'app : contexts/auth-context.tsx). Le code saisi a
   l'inscription est garde dans le navigateur jusqu'a la premiere connexion : avec la confirmation
   d'e-mail, signUp() ne donne pas de session, et Google/Apple quittent la page. Applique une seule
   fois puis efface, succes ou echec : un code refuse ne bloque jamais la connexion. Le serveur
   (apply_referral_code) refuse lui-meme un compte qui a deja achete. */
const CLE_PARRAINAGE = 'phonescore:code-parrainage-en-attente';

/* Lien de parrainage partagé depuis l'app ou le profil : phonescore.app/?ref=CODE
   (18 nov. 2026). Le code est gardé tout de suite (appliqué à la première connexion,
   Google et Apple compris) et pré-remplit le champ de l'inscription. Le serveur ne
   l'accepte que pour un compte de moins de 7 jours, sans achat. */
let codeDuLien = null;
(function lireLienParrainage() {
  const ref = (new URLSearchParams(location.search).get('ref') || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(ref)) return;
  codeDuLien = ref;
  try { localStorage.setItem(CLE_PARRAINAGE, ref); } catch (e) {}
})();

function codeParrainageSaisi() {
  return modeInscription ? $('code-parrainage').value.trim().toUpperCase() : '';
}

function memoriserParrainage() {
  const code = codeParrainageSaisi();
  try {
    if (code) localStorage.setItem(CLE_PARRAINAGE, code);
  } catch (e) {}
}

async function appliquerParrainageEnAttente() {
  let code = null;
  try {
    code = localStorage.getItem(CLE_PARRAINAGE);
    if (code) localStorage.removeItem(CLE_PARRAINAGE);
  } catch (e) {}
  if (!code) return;
  const { error } = await supabase.rpc('apply_referral_code', { p_code: code });
  if (error) console.warn('parrainage refusé', error.message);
}

let verifParrainage = 0;
async function verifierCodeParrainage() {
  const etat = $('etat-parrainage');
  const code = $('code-parrainage').value.trim();
  const n = ++verifParrainage;
  if (!code) { etat.classList.add('hidden'); return; }
  etat.classList.remove('hidden');
  etat.style.color = '';
  etat.textContent = PSI18N.t('auth.parrainageVerif');
  const { data, error } = await supabase.rpc('referral_code_exists', { p_code: code });
  if (n !== verifParrainage) return; // une saisie plus recente a pris le relais
  const valide = !error && data === true;
  etat.textContent = PSI18N.t(valide ? 'auth.parrainageValide' : 'auth.parrainageInvalide');
  etat.style.color = valide ? 'var(--green-l)' : '#FFB4B4';
}

$('code-parrainage').addEventListener('change', verifierCodeParrainage);
$('code-parrainage').addEventListener('input', () => $('etat-parrainage').classList.add('hidden'));

supabase.auth.onAuthStateChange((evt, session) => {
  rendre(session);
  if (evt === 'SIGNED_IN' && session) {
    appliquerParrainageEnAttente();
    marquerOrigineWeb(session.user.id);
    marquerCampagneWeb();
    marquerPaysWeb(session.user.id);
  }
});
supabase.auth.getSession().then(({ data }) => rendre(data.session));

/* ---------------- pop-ups : pièce offerte et parrainage ---------------- */

/* Pop-up en style « affiche », comme dans l'app (24 nov. 2026, components/popup-affiche.tsx) :
   fond bleu nuit, titre dans un cadre vert incliné, très grand chiffre, bouclier en grand,
   croix blanche, barre blanche d'action. Un seul à la fois. Aucun prix chiffré. */
function bouclierClone(classe) {
  const logo = document.querySelector('.brand svg');
  if (!logo) return null;
  const s = logo.cloneNode(true);
  s.removeAttribute('class');
  s.classList.add(classe);
  return s;
}

function ouvrirAffiche({ cadre, chiffre, unite, ligne, accent, cta, ctaAccent, code, action }) {
  document.querySelector('.popup-fond')?.remove();
  const el = (tag, classe, texte) => {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  };
  const fond = el('div', 'popup-fond');
  const carte = el('div', 'affiche');
  carte.setAttribute('role', 'dialog');
  carte.setAttribute('aria-modal', 'true');
  carte.setAttribute('aria-label', cadre);
  const fermer = () => { fond.remove(); document.removeEventListener('keydown', echap); };
  const echap = e => { if (e.key === 'Escape') fermer(); };

  const haut = el('div', 'affiche-haut');
  const grand = bouclierClone('affiche-bouclier');
  if (grand) haut.append(grand);
  const croix = el('button', 'affiche-fermer', '✕');
  croix.type = 'button';
  croix.setAttribute('aria-label', PSI18N.t('popups.affiche.fermer'));
  croix.addEventListener('click', fermer);
  haut.append(croix, el('p', 'affiche-cadre', cadre), el('div', 'affiche-espace'));

  const rangee = el('div', 'affiche-rangee');
  rangee.append(el('span', 'affiche-nombre', chiffre), el('span', 'affiche-unite', unite));
  const phrase = el('p', 'affiche-ligne', ligne + ' ');
  phrase.append(el('span', 'affiche-accent', accent));
  haut.append(rangee, phrase);
  if (code) {
    const ligneCode = el('p', 'affiche-code', code.libelle + ' ');
    ligneCode.append(el('b', '', code.valeur));
    haut.append(ligneCode);
  }

  const barre = el('button', 'affiche-barre');
  barre.type = 'button';
  const texteBarre = el('span', 'affiche-cta', cta + ' ');
  texteBarre.append(el('span', 'affiche-cta-accent', ctaAccent));
  const tuile = el('span', 'affiche-tuile');
  const petit = bouclierClone('affiche-tuile-logo');
  if (petit) tuile.append(petit);
  barre.append(texteBarre, tuile);
  barre.addEventListener('click', () => { if (action) action(); fermer(); });

  carte.append(haut, barre);
  fond.append(carte);
  fond.addEventListener('click', e => { if (e.target === fond) fermer(); });
  document.addEventListener('keydown', echap);
  document.body.append(fond);
  barre.focus();
}

const unitePieces = n => PSI18N.t(n > 1 ? 'popups.affiche.unites' : 'popups.affiche.uneUnite');

/* Code de parrainage du compte connecté, et lien de partage. */
async function popupParrainage() {
  const { data: code, error } = await supabase.rpc('ensure_referral_code');
  if (error || typeof code !== 'string') return;
  ouvrirAffiche({
    cadre: PSI18N.t('popups.affiche.parrCadre'),
    chiffre: '+1',
    unite: unitePieces(1),
    ligne: PSI18N.t('popups.affiche.parrLigne'),
    accent: PSI18N.t('popups.affiche.parrAccent'),
    cta: PSI18N.t('popups.affiche.parrCta'),
    ctaAccent: PSI18N.t('popups.affiche.parrCtaAccent'),
    code: { libelle: PSI18N.t('popups.codeLabel'), valeur: code },
    action: () => {
      const message = PSI18N.t('popups.partage', { code });
      if (navigator.share) navigator.share({ text: message }).catch(() => {});
      else navigator.clipboard?.writeText(message).catch(() => {});
    },
  });
}

/* Ouverture : pièce offerte une fois par compte, sinon parrainage une fois par jour
   tant que le compte n'a fait aucune vérification. */
async function popupsOuverture(userId) {
  const jour = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem('parrainage_jour_' + userId) === jour) return;
  localStorage.setItem('parrainage_jour_' + userId, jour);

  if (!localStorage.getItem('offre_vue_' + userId)) {
    const { data } = await supabase.rpc('mon_offre_inscription').then(r => r, () => ({ data: 0 }));
    if (typeof data === 'number' && data > 0) {
      localStorage.setItem('offre_vue_' + userId, '1');
      // Le nombre réel de pièces offertes selon le pays (10 en Côte d'Ivoire, 5 en France et aux
      // États-Unis) : l'ancien pop-up annonçait toujours « +1 pièce ».
      ouvrirAffiche({
        cadre: PSI18N.t('popups.affiche.offreCadre'),
        chiffre: '+' + data,
        unite: unitePieces(data),
        ligne: PSI18N.t('popups.affiche.offreLigne'),
        accent: PSI18N.t('popups.affiche.offreAccent'),
        cta: PSI18N.t('popups.affiche.offreCta'),
        ctaAccent: PSI18N.t('popups.affiche.offreCtaAccent'),
        action: () => {
          const champ = document.getElementById('imei') || document.getElementById('imei-accroche');
          if (champ) { champ.scrollIntoView({ behavior: 'smooth', block: 'center' }); champ.focus({ preventScroll: true }); }
        },
      });
      return;
    }
  }

  const { count } = await supabase.from('checks').select('id', { count: 'exact', head: true }).then(r => r, () => ({ count: null }));
  if (count === 0) popupParrainage();
}

/* Après une vérification : première, puis chaque 3e. */
async function popupsApresVerif() {
  const { count } = await supabase.from('checks').select('id', { count: 'exact', head: true }).then(r => r, () => ({ count: null }));
  if (count === 1 || (count ?? 0) % 3 === 0) popupParrainage();
}

async function rendre(session) {
  // Les 3 etapes « Connecte-toi / Choisis un pack / Paie » ne servent qu'avant la connexion :
  // une fois connecte, on les masque (l'acces a la recharge est deja dans la vue du compte).
  const mm = $('section-mm');
  if (mm) mm.hidden = !!session;
  if (session) {
    $('vue-auth').classList.add('hidden');
    $('form-accroche').classList.add('hidden');
    $('deja-compte').classList.add('hidden');
    $('vue-app').classList.remove('hidden');
    $('courriel').textContent = session.user.email ?? '';
    await rafraichirSolde();
    rafraichirStats();
    majApercu();
    proposerQuestionSource(session.user.id).catch(() => {});
    popupsOuverture(session.user.id).catch(() => {});
  } else {
    $('vue-app').classList.add('hidden');
    if ($('question-source')) $('question-source').classList.add('hidden');
    // La connexion ne s'affiche qu'a la demande (IMEI saisi, ou « Deja un
    // compte ») : sinon la page montrerait deux fois « verifier ».
    if (imeiEnAttente() || codeDuLien) montrerConnexion();
  }
}

/* Solde a zero : le mobile money n'existe qu'en zone FCFA (meme liste que js/recharger.js).
   Ailleurs, proposer « Orange Money » a un visiteur de Paris ou de Lagos ne mene nulle part :
   on l'envoie vers l'app iPhone, ou l'achat se fait par l'App Store. Pays inconnu : mobile money. */
const ZONE_FCFA = ['CI', 'SN', 'ML', 'BF', 'BJ', 'TG', 'NE', 'GW'];
let zoneAlerteReglee = false;
async function reglerZoneAlerte() {
  if (zoneAlerteReglee) return;
  zoneAlerteReglee = true;
  let pays = null;
  try { pays = (await (await fetch('/geo')).json()).country ?? null; } catch (e) {}
  const fcfa = !pays || ZONE_FCFA.includes(String(pays).toUpperCase());
  $('zero-fcfa').classList.toggle('hidden', !fcfa);
  if (!fcfa) $('zero-btn-fcfa').textContent = PSI18N.t('verif.zeroBtnCarte');
  for (const id of ['zero-app', 'zero-btn-app']) $(id).classList.toggle('hidden', fcfa);
}

async function rafraichirSolde() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  // La RLS restreint deja a la ligne de l'utilisateur, mais filtrer
  // explicitement evite un `single()` en echec si une policy evolue.
  const { data } = await supabase
    .from('profiles').select('pieces').eq('id', session.user.id).maybeSingle();
  soldeActuel = data ? data.pieces : null;
  $('solde').textContent = data ? data.pieces : '—';
  // Solde a zero : on montre la recharge mobile money au lieu de laisser
  // le bouton Verifier echouer.
  $('alerte-solde').classList.toggle('hidden', !(data && data.pieces === 0));
  if (data && data.pieces === 0) reglerZoneAlerte();
}

/* ---------------- authentification ---------------- */

// Connexion par defaut : c'est le cas le plus frequent (un compte deja cree),
// l'inscription reste a un clic derriere "Créer un nouveau compte" plutot
// que d'etre l'ecran d'accueil. Meme bascule que components/auth-screen.tsx
// cote app.
let modeInscription = false;

function basculerModeAuth(inscription) {
  modeInscription = inscription;
  if (inscription && codeDuLien && !$('code-parrainage').value.trim()) {
    $('code-parrainage').value = codeDuLien;
    verifierCodeParrainage();
  }
  $('champ-confirmation').classList.toggle('hidden', !modeInscription);
  $('champ-parrainage').classList.toggle('hidden', !modeInscription);
  $('btn-connexion').classList.toggle('hidden', modeInscription);
  $('btn-inscription').classList.toggle('hidden', !modeInscription);
  $('btn-basculer').textContent = PSI18N.t(modeInscription ? 'auth.basculerVersConnexion' : 'auth.basculerVersInscription');
  $('hint-connexion').classList.toggle('hidden', modeInscription);
  $('hint-inscription').classList.toggle('hidden', !modeInscription);
  $('sous-titre-auth').textContent = PSI18N.t(modeInscription ? 'auth.sousTitreInscription' : 'auth.sousTitreConnexion');
  $('mdp').setAttribute('autocomplete', modeInscription ? 'new-password' : 'current-password');
  $('mdp-confirmation').value = '';
  effacer($('msg-auth'));
}

$('btn-basculer').addEventListener('click', () => basculerModeAuth(!modeInscription));

$('btn-connexion').addEventListener('click', async () => {
  const email = $('email').value.trim().toLowerCase();
  const password = $('mdp').value;
  if (!email || !password) return afficher($('msg-auth'), PSI18N.t('auth.champsManquants'), 'err');

  occupe($('btn-connexion'), true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  occupe($('btn-connexion'), false, PSI18N.t('auth.connexion'));
  if (error) afficher($('msg-auth'), PSI18N.t('auth.connexionRefusee'), 'err');
});

// `occupe()` remplace tout le contenu du bouton par le libelle donne : garder
// l'icone sous la main pour la restaurer si la tentative echoue, plutot que
// de laisser le bouton perdre son logo Apple apres une erreur.
// Retour apres Google / Apple sur l'accueil de la langue de la page (18 nov. 2026 :
// une connexion lancee depuis /en/ revenait sur l'accueil francais). Meme domaine que
// l'adresse du site configuree dans Supabase : accepte sans entree supplementaire.
function adresseRetourConnexion() {
  return PSI18N.langueActuelle() === 'en' ? 'https://phonescore.app/en/' : 'https://phonescore.app/';
}

const CONTENU_BTN_APPLE = $('btn-apple').innerHTML;

$('btn-apple').addEventListener('click', async () => {
  effacer($('msg-auth'));
  memoriserParrainage();
  occupe($('btn-apple'), true);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: adresseRetourConnexion() },
  });
  // Pas de reactivation du bouton en cas de succes : la page part vers Apple.
  if (error) {
    occupe($('btn-apple'), false, CONTENU_BTN_APPLE);
    afficher($('msg-auth'), PSI18N.t('auth.appleEchec'), 'err');
  }
});

const CONTENU_BTN_GOOGLE = $('btn-google').innerHTML;

$('btn-google').addEventListener('click', async () => {
  effacer($('msg-auth'));
  memoriserParrainage();
  occupe($('btn-google'), true);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: adresseRetourConnexion() },
  });
  // Pas de reactivation du bouton en cas de succes : la page part vers Google.
  if (error) {
    occupe($('btn-google'), false, CONTENU_BTN_GOOGLE);
    afficher($('msg-auth'), PSI18N.t('auth.googleEchec'), 'err');
  }
});

$('btn-inscription').addEventListener('click', async () => {
  const email = $('email').value.trim().toLowerCase();
  const password = $('mdp').value;
  if (password.length < 8) return afficher($('msg-auth'), PSI18N.t('auth.mdpTropCourt'), 'err');
  if (password !== $('mdp-confirmation').value) return afficher($('msg-auth'), PSI18N.t('auth.mdpDifferents'), 'err');

  memoriserParrainage();
  occupe($('btn-inscription'), true);
  // Langue de l'e-mail de confirmation ({{ .Data.langue }} dans le modèle Supabase) :
  // celle du navigateur si un texte existe (fr, en, es, ar), sinon celle du site.
  const navig = String(navigator.language || '').slice(0, 2).toLowerCase();
  const langue = ['fr', 'en', 'es', 'ar'].includes(navig) ? navig : PSI18N.langueActuelle();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { langue } } });
  occupe($('btn-inscription'), false, PSI18N.t('auth.inscription'));

  if (error) {
    // Inscription refusee (adresse deja prise...) : le code ne doit pas suivre une connexion
    // ulterieure a un autre compte.
    try { localStorage.removeItem(CLE_PARRAINAGE); } catch (e) {}
    return afficher($('msg-auth'), PSI18N.t('auth.inscriptionEchec'), 'err');
  }
  // Selon le reglage de confirmation d'e-mail, la session peut etre nulle :
  // le compte existe mais rien n'est encore signe. On repasse sur l'ecran de
  // connexion, ou l'utilisateur atterrira de toute facon apres avoir confirme.
  if (!data.session) {
    basculerModeAuth(false);
    afficher($('msg-auth'), PSI18N.t('auth.inscriptionOk'), 'ok');
  }
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
    $('stats').classList.toggle('hidden', n === 0);

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

/* ---------------- verification ---------------- */

for (const [id, valeur] of [['t-iphone', 'iphone'], ['t-macbook', 'macbook']]) {
  $(id).addEventListener('click', () => {
    type = valeur;
    $('t-iphone').setAttribute('aria-pressed', String(valeur === 'iphone'));
    $('t-macbook').setAttribute('aria-pressed', String(valeur === 'macbook'));
    $('niveaux').classList.toggle('hidden', valeur !== 'macbook');
    majApercu();
  });
}

for (const [id, valeur] of [['n-standard', 'standard'], ['n-complet', 'complet']]) {
  $(id).addEventListener('click', () => {
    niveau = valeur;
    $('n-standard').setAttribute('aria-pressed', String(valeur === 'standard'));
    $('n-complet').setAttribute('aria-pressed', String(valeur === 'complet'));
  });
}

// Les edge functions renvoient un message utile dans le corps meme en erreur ;
// supabase-js ne l'expose que via error.context.
async function messageErreur(error, defaut) {
  try {
    return messageServeur(await error?.context?.json(), defaut);
  } catch { /* corps illisible : on garde le message par defaut */ }
  return defaut;
}

// check-imei ecrit son `message` en francais ; depuis le 18 nov. 2026 il joint un
// `code` stable, traduit ici dans la langue de la page (serverErrors.* de i18n.js).
// Sans code connu : le message du serveur, puis le texte par defaut.
function messageServeur(corps, defaut) {
  if (typeof corps?.code === 'string') {
    const cle = 'serverErrors.' + corps.code;
    const texte = PSI18N.t(cle);
    if (texte !== cle) return texte;
  }
  return corps?.message || defaut;
}

// Etapes qui s'enchainent pendant l'attente (jusqu'a une minute) plutot
// qu'une simple animation decorative. Rythme simule cote client -- aucun
// signal de progression reel ne vient du backend (une seule requete, pas de
// flux) -- mais reste sur la derniere etape (toujours active) si la reponse
// tarde, sans jamais boucler : ce n'est pas une demo, une seule verification
// tourne a la fois.
const ETAPES_INTERVALLE_MS = 4000;
let minuteurEtapes = null;

function demarrerEtapesVerif() {
  const etapes = [...document.querySelectorAll('#etapes-verif .etape')];
  let i = 0;
  const jouer = () => {
    etapes.forEach((e, idx) => {
      e.classList.remove('actif', 'fait');
      if (idx < i) e.classList.add('fait');
      if (idx === i) e.classList.add('actif');
    });
    if (i >= etapes.length - 1) {
      clearInterval(minuteurEtapes);
      minuteurEtapes = null;
      return;
    }
    i += 1;
  };
  jouer();
  minuteurEtapes = setInterval(jouer, ETAPES_INTERVALLE_MS);
}

function arreterEtapesVerif() {
  clearInterval(minuteurEtapes);
  minuteurEtapes = null;
}

$('btn-verifier').addEventListener('click', async () => {
  effacer($('msg-verif'));
  $('rapport').classList.add('hidden');

  // Saisies qui ne peuvent pas aboutir : refusees avant le debit (memes
  // regles que l'app, lib/imei-validation.ts).
  const { valeur: imei, nature } = analyserSaisie($('imei').value);
  if (nature === 'samsung') return afficher($('msg-verif'), PSI18N.t('verif.appleSeul'), 'err');
  if (nature === 'eid' || nature === 'iccid') return afficher($('msg-verif'), PSI18N.t('verif.numeroSim'), 'err');
  // « 354…784/01 », espaces, IMEISV : le champ montre le numero reellement verifie.
  if (imei !== $('imei').value.trim()) $('imei').value = imei;

  if (imei.length < 8) return afficher($('msg-verif'), PSI18N.t('verif.imeiInvalide'), 'err');

  const cout = type === 'macbook' ? (niveau === 'complet' ? 4 : 2) : 1;
  if (soldeActuel !== null && soldeActuel < cout) {
    $('alerte-solde').classList.remove('hidden');
    reglerZoneAlerte();
    return afficher($('msg-verif'), PSI18N.t('verif.soldeInsuffisant'), 'err');
  }
  // 15 chiffres mais cle de controle fausse : presque toujours un chiffre mal
  // recopie, et la piece serait debitee pour un appareil qui n'existe pas.
  if (type === 'iphone' && /^\d{15}$/.test(imei) && !estImeiValide(imei)
      && !window.confirm(PSI18N.t('verif.cleFausse'))) return;

  jetonApercu++;
  masquerApercu();

  occupe($('btn-verifier'), true);
  $('chargement-verif').classList.remove('hidden');
  demarrerEtapesVerif();
  const { data, error } = await supabase.functions.invoke('check-imei', {
    // Le niveau ne concerne que le MacBook cote site.
    body: type === 'macbook' ? { imei, type, niveau } : { imei, type },
  });
  arreterEtapesVerif();
  occupe($('btn-verifier'), false, PSI18N.t('verif.btn'));
  $('chargement-verif').classList.add('hidden');

  if (error) {
    return afficher($('msg-verif'), await messageErreur(error, PSI18N.t('verif.erreurDefaut')), 'err');
  }
  if (!data?.success) {
    return afficher($('msg-verif'), messageServeur(data, PSI18N.t('verif.introuvable')), 'err');
  }

  await rafraichirSolde();
  // Rendu partage avec la fiche d'un element de l'historique (profil.js) :
  // voir js/rapport-commun.js, charge avant ce script.
  afficherRapportDans('rapport', data.report);
  popupsApresVerif().catch(() => {});
});

/* ---------------- champ IMEI de l'accroche ---------------- */

// Le visiteur tape l'IMEI des la premiere vue ; on le reporte dans l'outil,
// plus bas, et on l'y emmene. Garde en sessionStorage : une connexion Apple
// ou Google recharge la page, l'IMEI ne doit pas se perdre en route.
const CLE_IMEI_ATTENTE = 'imei-attente';

$('form-accroche')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const imei = $('imei-accroche').value.trim();
  if (imei) {
    $('imei').value = imei;
    montrerImeiPret(imei);
    try { sessionStorage.setItem(CLE_IMEI_ATTENTE, imei); } catch { /* navigation privee */ }
    majApercu();
  }
  montrerConnexion();
  setTimeout(() => $('btn-apple')?.focus({ preventScroll: true }), 400);
});

// Remplace l'accroche par la connexion, au meme endroit.
function montrerConnexion() {
  $('form-accroche').classList.add('hidden');
  $('deja-compte').classList.add('hidden');
  $('vue-auth').classList.remove('hidden');
  // Arrivé par le lien d'un ami : on ouvre directement l'inscription, code pré-rempli.
  if (codeDuLien && !modeInscription) basculerModeAuth(true);
  $('verifier').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function imeiEnAttente() {
  try { return sessionStorage.getItem(CLE_IMEI_ATTENTE); } catch { return null; }
}

$('lien-connexion').addEventListener('click', (e) => {
  e.preventDefault();
  montrerConnexion();
});

// Rappel cote connexion : le visiteur voit que son IMEI l'attend.
function montrerImeiPret(imei) {
  $('imei-pret-val').textContent = imei;
  $('imei-pret').classList.remove('hidden');
}

try {
  const enAttente = sessionStorage.getItem(CLE_IMEI_ATTENTE);
  if (enAttente && !$('imei').value) {
    $('imei').value = enAttente;
    montrerImeiPret(enAttente);
  }
} catch { /* navigation privee */ }

/* ---------------- controle de saisie ---------------- */

// Portage de lib/imei-validation.ts (app) : garder les deux identiques.
function sommeLuhn(chiffres) {
  let total = 0;
  for (let i = chiffres.length - 1, rang = 0; i >= 0; i--, rang++) {
    let n = chiffres.charCodeAt(i) - 48;
    if (rang % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    total += n;
  }
  return total;
}

function estImeiValide(valeur) {
  const v = (valeur ?? '').trim();
  return /^\d{15}$/.test(v) && sommeLuhn(v) % 10 === 0;
}

function cleAttendue(quatorze) {
  if (!/^\d{14}$/.test(quatorze)) return null;
  return (10 - (sommeLuhn(quatorze + '0') % 10)) % 10;
}

function analyserSaisie(brut) {
  const compacte = (brut ?? '').trim().toUpperCase().replace(/[\s\-./]/g, '');
  if (/^\d+$/.test(compacte)) {
    // EID d'une eSIM (32 chiffres) ou ICCID d'une carte SIM (19-20), tous deux en 89.
    if (compacte.length === 32 && compacte.startsWith('89')) return { valeur: compacte, nature: 'eid' };
    if ((compacte.length === 19 || compacte.length === 20) && compacte.startsWith('89')) return { valeur: compacte, nature: 'iccid' };
    // IMEI suivi de la version logicielle (« 354…784/01 »).
    if (compacte.length === 17 && estImeiValide(compacte.slice(0, 15))) return { valeur: compacte.slice(0, 15), nature: 'imei' };
    // IMEISV : 14 chiffres + 2 de version, sans cle : on la recalcule.
    if (compacte.length === 16) {
      const cle = cleAttendue(compacte.slice(0, 14));
      if (cle !== null) return { valeur: compacte.slice(0, 14) + cle, nature: 'imei' };
    }
    return { valeur: compacte, nature: compacte.length === 15 ? 'imei' : 'autre' };
  }
  // Numero de serie Samsung : « R », un chiffre, neuf caracteres.
  if (/^R\d[A-Z0-9]{9}$/.test(compacte)) return { valeur: compacte, nature: 'samsung' };
  return { valeur: compacte, nature: 'autre' };
}

/* ---------------- fiche du modele (apercu gratuit) ---------------- */

// Copie de lib/fiche-modele.ts + lib/sortie-modeles.ts de l'app (26 oct. 2026) : annee, puce et diagonale
// d'ecran d'apres le seul nom du modele, aucun appel payant. Un modele sans fiche sure (17e, 18 Pro, 18 Pro
// Max, Duo) n'affiche que l'annee ; un modele inconnu n'affiche rien. A garder en phase avec l'app.
const FICHES = {
  'iphone x': { annee: '2017', puce: 'A11 Bionic', ecran: '5.8' },
  'iphone xs': { annee: '2018', puce: 'A12 Bionic', ecran: '5.8' },
  'iphone xs max': { annee: '2018', puce: 'A12 Bionic', ecran: '6.5' },
  'iphone xr': { annee: '2018', puce: 'A12 Bionic', ecran: '6.1' },
  'iphone 11': { annee: '2019', puce: 'A13 Bionic', ecran: '6.1' },
  'iphone 11 pro': { annee: '2019', puce: 'A13 Bionic', ecran: '5.8' },
  'iphone 11 pro max': { annee: '2019', puce: 'A13 Bionic', ecran: '6.5' },
  'iphone 12': { annee: '2020', puce: 'A14 Bionic', ecran: '6.1' },
  'iphone 12 pro': { annee: '2020', puce: 'A14 Bionic', ecran: '6.1' },
  'iphone 12 mini': { annee: '2020', puce: 'A14 Bionic', ecran: '5.4' },
  'iphone 12 pro max': { annee: '2020', puce: 'A14 Bionic', ecran: '6.7' },
  'iphone 13 mini': { annee: '2021', puce: 'A15 Bionic', ecran: '5.4' },
  'iphone 13': { annee: '2021', puce: 'A15 Bionic', ecran: '6.1' },
  'iphone 13 pro': { annee: '2021', puce: 'A15 Bionic', ecran: '6.1' },
  'iphone 13 pro max': { annee: '2021', puce: 'A15 Bionic', ecran: '6.7' },
  'iphone 14': { annee: '2022', puce: 'A15 Bionic', ecran: '6.1' },
  'iphone 14 pro': { annee: '2022', puce: 'A16 Bionic', ecran: '6.1' },
  'iphone 14 pro max': { annee: '2022', puce: 'A16 Bionic', ecran: '6.7' },
  'iphone 14 plus': { annee: '2022', puce: 'A15 Bionic', ecran: '6.7' },
  'iphone 15': { annee: '2023', puce: 'A16 Bionic', ecran: '6.1' },
  'iphone 15 plus': { annee: '2023', puce: 'A16 Bionic', ecran: '6.7' },
  'iphone 15 pro': { annee: '2023', puce: 'A17 Pro', ecran: '6.1' },
  'iphone 15 pro max': { annee: '2023', puce: 'A17 Pro', ecran: '6.7' },
  'iphone 16': { annee: '2024', puce: 'A18', ecran: '6.1' },
  'iphone 16 plus': { annee: '2024', puce: 'A18', ecran: '6.7' },
  'iphone 16 pro': { annee: '2024', puce: 'A18 Pro', ecran: '6.3' },
  'iphone 16 pro max': { annee: '2024', puce: 'A18 Pro', ecran: '6.9' },
  'iphone 16e': { annee: '2025', puce: 'A18', ecran: '6.1' },
  'iphone 17': { annee: '2025', puce: 'A19', ecran: '6.3' },
  'iphone 17 pro': { annee: '2025', puce: 'A19 Pro', ecran: '6.3' },
  'iphone 17 pro max': { annee: '2025', puce: 'A19 Pro', ecran: '6.9' },
  'iphone air': { annee: '2025', puce: 'A19 Pro', ecran: '6.5' },
  'iphone 17e': { annee: '2026' },
  'iphone 18 pro': { annee: '2026' },
  'iphone 18 pro max': { annee: '2026' },
  'iphone duo': { annee: '2026' },
};

function afficherFiche(modele) {
  const f = FICHES[String(modele).toLowerCase().trim()];
  const cases = [['sortie', f?.annee], ['puce', f?.puce], ['ecran', f?.ecran ? `${f.ecran}"` : null]];
  for (const [nom, valeur] of cases) {
    $(`apercu-fiche-${nom}`).hidden = !valeur;
    $(`apercu-fiche-${nom}-v`).textContent = valeur ?? '';
  }
  $('apercu-fiche').classList.toggle('hidden', !cases.some(([, v]) => v));
}

/* ---------------- apercu gratuit ---------------- */

// Modele lu dans la base TAC (8 premiers chiffres de l'IMEI), sans appel
// payant. Seulement pour un IMEI complet et valide dans l'onglet iPhone. Le
// serveur compte (3 par semaine et par compte) ; sans reponse de sa part, pas
// d'apercu, jamais un apercu illimite. Portage de app/(tabs)/index.tsx.
const APERCU_ATTENTE_MS = 2200;
let baseTac = null;
let jetonApercu = 0;
let minuteurSaisie = null;

function chargerBaseTac() {
  baseTac ??= fetch('/data/tac.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
  return baseTac;
}

function lireReponseApercu(d) {
  if (!d || typeof d !== 'object' || typeof d.allowed !== 'boolean' || typeof d.limit !== 'number') return null;
  if (d.allowed) return typeof d.remaining === 'number' ? { autorise: true, restants: d.remaining } : null;
  const date = typeof d.resets_at === 'string' ? new Date(d.resets_at) : null;
  return { autorise: false, reprendLe: date && !Number.isNaN(date.getTime()) ? date : null };
}

function masquerApercu() {
  for (const id of ['apercu', 'apercu-attente', 'apercu-limite']) $(id).classList.add('hidden');
  $('btn-verifier').classList.remove('hidden');
}

async function majApercu() {
  const jeton = ++jetonApercu;
  masquerApercu();
  const chiffres = $('imei').value.replace(/\D/g, '');
  if (type !== 'iphone' || !estImeiValide(chiffres) || $('vue-app').classList.contains('hidden')) return;

  const base = await chargerBaseTac();
  const indice = base?.tac?.[chiffres.slice(0, 8)];
  if (jeton !== jetonApercu || indice === undefined) return;

  $('apercu-attente').classList.remove('hidden');
  const debut = Date.now();
  const { data, error } = await supabase.rpc('consume_demo_preview', { p_imei: chiffres });
  const reste = APERCU_ATTENTE_MS - (Date.now() - debut);
  if (reste > 0) await new Promise(r => setTimeout(r, reste));
  if (jeton !== jetonApercu) return;
  $('apercu-attente').classList.add('hidden');
  if (error) return;

  const reponse = lireReponseApercu(data);
  if (!reponse) return;
  if (reponse.autorise) {
    $('apercu-modele').textContent = base.modeles[indice];
    afficherFiche(base.modeles[indice]);
    // Sans piece, « Debloquer » mene a la recharge plutot qu'a une impasse.
    $('apercu-cout').textContent = PSI18N.t(soldeActuel === 0 ? 'apercu.coutZero' : 'apercu.coutUn');
    $('apercu-restants').textContent = PSI18N.t(reponse.restants === 1 ? 'apercu.restantUn' : 'apercu.restants', { n: reponse.restants });
    $('apercu').classList.remove('hidden');
    $('btn-verifier').classList.add('hidden');
  } else {
    $('apercu-limite').textContent = reponse.reprendLe
      ? PSI18N.t('apercu.limite', { date: reponse.reprendLe.toLocaleDateString(PSI18N.langueActuelle()) })
      : PSI18N.t('apercu.limiteSansDate');
    $('apercu-limite').classList.remove('hidden');
  }
}

$('imei').addEventListener('input', () => {
  clearTimeout(minuteurSaisie);
  minuteurSaisie = setTimeout(majApercu, 350);
});

$('apercu-debloquer').addEventListener('click', () => {
  if (soldeActuel === 0) { window.location.href = '/recharger'; return; }
  $('btn-verifier').click();
});
