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
    const locale = PSI18N.langueActuelle() === 'en' ? 'en-US' : 'fr-FR';
    $('revendeur').textContent = actif
      ? PSI18N.t('profilPage.revendeurJusquau', {
          date: new Date(jusqua).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
        })
      : PSI18N.t('profilPage.revendeurAucun');
    $('revendeur').classList.toggle('actif', !!actif);
  }

  if (code.status === 'fulfilled' && typeof code.value.data === 'string') {
    $('code').textContent = code.value.data;
  }

  if (filleuls.status === 'fulfilled') {
    $('filleuls').textContent = filleuls.value.count ?? 0;
  }
}

$('btn-deconnexion').addEventListener('click', () => supabase.auth.signOut());

/* Double confirmation : l'action est irreversible et detruit des pieces
   payees. Meme exigence que dans l'application. */
$('btn-supprimer').addEventListener('click', async () => {
  if (!confirm(PSI18N.t('profilPage.confirmSuppression1'))) return;
  if (!confirm(PSI18N.t('profilPage.confirmSuppression2'))) return;

  const msg = $('msg');
  msg.textContent = PSI18N.t('profilPage.suppressionEnCours');
  msg.className = 'msg';
  try {
    const { data, error } = await supabase.functions.invoke('delete-account');
    if (error || !data?.success) throw error ?? new Error('echec');
    await supabase.auth.signOut();
    location.replace('/');
  } catch {
    msg.textContent = PSI18N.t('profilPage.suppressionEchec');
    msg.className = 'msg err';
  }
});
