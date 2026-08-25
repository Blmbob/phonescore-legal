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
  } else {
    $('vue-app').classList.add('hidden');
    $('vue-auth').classList.remove('hidden');
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
  $('btn-basculer').textContent = modeInscription ? 'J’ai déjà un compte' : 'Créer un nouveau compte';
  $('hint-connexion').classList.toggle('hidden', modeInscription);
  $('hint-inscription').classList.toggle('hidden', !modeInscription);
  $('sous-titre-auth').textContent = modeInscription
    ? 'Créez un compte en quelques secondes — puis vérifiez un appareil.'
    : 'Connectez-vous pour vérifier un appareil.';
  $('mdp').setAttribute('autocomplete', modeInscription ? 'new-password' : 'current-password');
  $('mdp-confirmation').value = '';
  effacer($('msg-auth'));
}

$('btn-basculer').addEventListener('click', () => basculerModeAuth(!modeInscription));

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
  // Selon le reglage de confirmation d'e-mail, la session peut etre nulle :
  // le compte existe mais rien n'est encore signe. On repasse sur l'ecran de
  // connexion, ou l'utilisateur atterrira de toute facon apres avoir confirme.
  if (!data.session) {
    basculerModeAuth(false);
    afficher($('msg-auth'), 'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.', 'ok');
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
  // Rendu partage avec la fiche d'un element de l'historique (profil.js) :
  // voir js/rapport-commun.js, charge avant ce script.
  afficherRapportDans('rapport', data.report);
});
