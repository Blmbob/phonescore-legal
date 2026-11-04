/* Sorti de recharger.html pour que la CSP puisse refuser le script en ligne.
   Ne pas remettre ce code dans la page : script-src vaut 'self'. */
const { createClient } = window.supabase;

const SUPABASE_URL = "https://bvriicetjcnxrbhelokh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_p35a312TC0qA8YDdw_fWAQ_b0AUrfqf";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);

function montrer(quoi) {
  for (const id of ['attente', 'deconnecte', 'achat']) {
    $(id).classList.toggle('hidden', id !== quoi);
  }
}

supabase.auth.onAuthStateChange((_evt, session) => rendre(session));
supabase.auth.getSession().then(({ data }) => rendre(data.session));

/* Pays de la zone FCFA (UEMOA), les seuls où GeniusPay propose un moyen de
   paiement utilisable (Orange Money, MTN, Moov, Wave). */
const ZONE_FCFA = ['CI', 'SN', 'ML', 'BF', 'BJ', 'TG', 'NE', 'GW'];

/* Pays du visiteur d'après Cloudflare (functions/geo.js). null si inconnu :
   on montre alors le paiement mobile money, comme avant. */
async function paysVisiteur() {
  try {
    return (await (await fetch('/geo')).json()).country ?? null;
  } catch {
    return null;
  }
}

function afficherPaiement(fcfa) {
  $('paiement-fcfa').classList.toggle('hidden', !fcfa);
  $('hors-zone').classList.toggle('hidden', fcfa);
}

async function appliquerZone() {
  const pays = await paysVisiteur();
  afficherPaiement(!pays || ZONE_FCFA.includes(String(pays).toUpperCase()));
}

/* Détection fausse (VPN, voyage) : le visiteur peut quand même payer. */
$('afficher-fcfa').addEventListener('click', () => afficherPaiement(true));

async function rendre(session) {
  if (!session) {
    montrer('deconnecte');
    return;
  }
  montrer('achat');
  appliquerZone();
  /* Mesure d'entonnoir : un echec ne doit jamais gener la page. */
  supabase.rpc('log_funnel_event', { p_event: 'recharge_view', p_canal: 'site' }).then(() => {}, () => {});

  const { data } = await supabase
    .from('profiles').select('pieces').eq('id', session.user.id).single();
  if (data) $('solde').textContent = data.pieces ?? 0;
}

for (const bouton of document.querySelectorAll('.offre')) {
  bouton.addEventListener('click', async () => {
    const msg = $('msg');
    msg.textContent = '';
    msg.className = 'msg';

    /* L'identifiant vient de l'attribut data-pack, lu via dataset.pack :
       le trait d'union du nom d'attribut disparait dans dataset. */
    const pack_id = bouton.dataset.pack;
    bouton.disabled = true;
    supabase.rpc('log_funnel_event', { p_event: 'pack_tap', p_canal: 'site' }).then(() => {}, () => {});

    const { data, error } = await supabase.functions
      .invoke('create-payment', { body: { pack_id } });

    bouton.disabled = false;

    if (error || !data?.checkout_url) {
      msg.textContent = PSI18N.t('rechargerPage.paiementEchec');
      msg.className = 'msg err';
      return;
    }
    /* GeniusPay ramene ensuite sur payment-result.html, qui renvoie ici. */
    window.location.href = data.checkout_url;
  });
}
