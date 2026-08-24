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

function afficherRapport(r) {
  const v = LIBELLE[r.verdict] ?? LIBELLE.warning;
  const sim = configurationSim(r);
  const lignes = [
    ligne('Modèle', r.model),
    ligne('Capacité', r.capacity),
    ligne('Numéro de série', r.serialNumber),
    r.fmiOn === null ? '' : ligne('Verrou iCloud', r.fmiOn ? 'Activé' : 'Désactivé', r.fmiOn ? 'ko-v' : 'ok-v'),
    r.blacklisted === null ? '' : ligne('Liste noire', r.blacklisted ? 'Signalé' : 'Non signalé', r.blacklisted ? 'ko-v' : 'ok-v'),
    r.simLockStatus ? ligne('Verrou opérateur', r.simLockStatus === 'locked' ? 'Verrouillé' : 'Désimlocké',
                            r.simLockStatus === 'locked' ? 'ko-v' : 'ok-v') : '',
    ligne('Opérateur', r.carrier),
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

  $('rapport').innerHTML =
    `<div class="verdict ${ton}"><b>${v.titre}</b><span>${v.detail}</span></div><dl>${lignes}</dl>${alerteSim}`;
  $('rapport').classList.remove('hidden');
  $('rapport').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
