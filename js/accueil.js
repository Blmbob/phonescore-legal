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

supabase.auth.onAuthStateChange((evt, session) => {
  rendre(session);
  if (evt === 'SIGNED_IN' && session) {
    marquerOrigineWeb(session.user.id);
    marquerCampagneWeb();
    marquerPaysWeb(session.user.id);
  }
});
supabase.auth.getSession().then(({ data }) => rendre(data.session));

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
  } else {
    $('vue-app').classList.add('hidden');
    // La connexion ne s'affiche qu'a la demande (IMEI saisi, ou « Deja un
    // compte ») : sinon la page montrerait deux fois « verifier ».
    if (imeiEnAttente()) montrerConnexion();
  }
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
}

/* ---------------- authentification ---------------- */

// Connexion par defaut : c'est le cas le plus frequent (un compte deja cree),
// l'inscription reste a un clic derriere "Créer un nouveau compte" plutot
// que d'etre l'ecran d'accueil. Meme bascule que components/auth-screen.tsx
// cote app.
let modeInscription = false;

function basculerModeAuth(inscription) {
  modeInscription = inscription;
  $('champ-confirmation').classList.toggle('hidden', !modeInscription);
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
    afficher($('msg-auth'), PSI18N.t('auth.appleEchec'), 'err');
  }
});

const CONTENU_BTN_GOOGLE = $('btn-google').innerHTML;

$('btn-google').addEventListener('click', async () => {
  effacer($('msg-auth'));
  occupe($('btn-google'), true);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://phonescore.app/' },
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

  occupe($('btn-inscription'), true);
  const { data, error } = await supabase.auth.signUp({ email, password });
  occupe($('btn-inscription'), false, PSI18N.t('auth.inscription'));

  if (error) return afficher($('msg-auth'), PSI18N.t('auth.inscriptionEchec'), 'err');
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
    const corps = await error?.context?.json();
    if (corps?.message) return corps.message;
  } catch { /* corps illisible : on garde le message par defaut */ }
  return defaut;
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
    return afficher($('msg-verif'), data?.message || PSI18N.t('verif.introuvable'), 'err');
  }

  await rafraichirSolde();
  // Rendu partage avec la fiche d'un element de l'historique (profil.js) :
  // voir js/rapport-commun.js, charge avant ce script.
  afficherRapportDans('rapport', data.report);
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
