/* Sorti de profil.html pour que la CSP puisse refuser le script en ligne.
   Ne pas remettre ce code dans la page : script-src vaut 'self'. */
const { createClient } = window.supabase;

const SUPABASE_URL = "https://bvriicetjcnxrbhelokh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_p35a312TC0qA8YDdw_fWAQ_b0AUrfqf";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);

function montrer(quoi) {
  for (const id of ['attente', 'deconnecte', 'compte']) {
    $(id).classList.toggle('hidden', id !== quoi);
  }
}

supabase.auth.onAuthStateChange((_evt, session) => rendre(session));
supabase.auth.getSession().then(({ data }) => rendre(data.session));

async function rendre(session) {
  if (!session) {
    montrer('deconnecte');
    // Replie et efface l'historique pour qu'une session suivante, sur le
    // meme appareil, ne parte pas d'une liste deja rempli et depliee.
    $('historique-toggle').setAttribute('aria-expanded', 'false');
    $('historique-corps').classList.add('hidden');
    $('historique-liste').innerHTML = '';
    $('historique-vide').classList.add('hidden');
    $('historique-plus').classList.add('hidden');
    $('historique-rapport').classList.add('hidden');
    decalageHistorique = 0;
    historiqueTermine = false;
    historiqueCharge = false;
    return;
  }
  montrer('compte');
  $('courriel').textContent = session.user.email ?? '';
  charger(session.user.id);
}

/* Quatre requetes independantes : une seule qui echoue ne doit pas priver
   l'utilisateur des autres, d'ou allSettled plutot que all. */
async function charger(uid) {
  const [profil, code, filleuls] = await Promise.allSettled([
    supabase.from('profiles').select('pieces, pro_until').eq('id', uid).single(),
    supabase.rpc('ensure_referral_code'),
    supabase.from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_user_id', uid).eq('status', 'rewarded'),
  ]);

  if (profil.status === 'fulfilled' && profil.value.data) {
    $('solde').textContent = profil.value.data.pieces ?? 0;

    /* pro_until fait foi : `role` peut rester a 'reseller' apres expiration. */
    const jusqua = profil.value.data.pro_until;
    const actif = jusqua && new Date(jusqua) > new Date();
    $('revendeur').textContent = actif
      ? 'jusqu’au ' + new Date(jusqua).toLocaleDateString('fr-FR',
          { day: 'numeric', month: 'long', year: 'numeric' })
      : 'aucun';
    $('revendeur').classList.toggle('actif', !!actif);
  }

  if (code.status === 'fulfilled' && typeof code.value.data === 'string') {
    $('code').textContent = code.value.data;
  }

  if (filleuls.status === 'fulfilled') {
    $('filleuls').textContent = filleuls.value.count ?? 0;
  }
}

/* ---------------- historique ---------------- */

const TAILLE_PAGE_HISTORIQUE = 10;
let decalageHistorique = 0;
let historiqueTermine = false;
let historiqueCharge = false;

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
    $('historique-rapport').classList.add('hidden');
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
    // Rendu partage avec le resultat d'une nouvelle verification (index.html) :
    // voir js/rapport-commun.js, charge avant ce script.
    div.addEventListener('click', () => afficherRapportDans('historique-rapport', item.report_data));
    $('historique-liste').appendChild(div);
  }
}

$('historique-plus').addEventListener('click', () => chargerHistorique(false));

// Repliee par defaut : la liste ne se charge qu'a la premiere ouverture,
// pas a chaque connexion.
$('historique-toggle').addEventListener('click', () => {
  const ouvert = $('historique-toggle').getAttribute('aria-expanded') === 'true';
  $('historique-toggle').setAttribute('aria-expanded', String(!ouvert));
  $('historique-corps').classList.toggle('hidden', ouvert);
  if (!ouvert && !historiqueCharge) {
    historiqueCharge = true;
    chargerHistorique(true);
  }
});

$('btn-deconnexion').addEventListener('click', () => supabase.auth.signOut());

/* Double confirmation : l'action est irreversible et detruit des pieces
   payees. Meme exigence que dans l'application. */
$('btn-supprimer').addEventListener('click', async () => {
  if (!confirm('Supprimer votre compte ?\n\nVos pièces, votre historique de vérifications et vos boutiques seront définitivement effacés.')) return;
  if (!confirm('Dernière confirmation.\n\nVos pièces non utilisées seront perdues et ne seront pas remboursées.')) return;

  const msg = $('msg');
  msg.textContent = 'Suppression en cours…';
  msg.className = 'msg';
  try {
    const { data, error } = await supabase.functions.invoke('delete-account');
    if (error || !data?.success) throw error ?? new Error('echec');
    await supabase.auth.signOut();
    location.replace('/');
  } catch {
    msg.textContent = 'La suppression a échoué. Réessayez, ou écrivez à support@phonescore.app.';
    msg.className = 'msg err';
  }
});
