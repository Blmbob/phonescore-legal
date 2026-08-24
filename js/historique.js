/* Sorti de historique.html pour que la CSP puisse refuser le script en ligne.
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
  chargerHistorique(true);
}

const TAILLE_PAGE = 15;
let decalage = 0;
let termine = false;

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

/* Accordeon a un seul volet ouvert a la fois : le detail apparait juste sous
   la ligne cliquee, avec une transition de hauteur, plutot que de sauter vers
   un gros bloc de rapport ailleurs sur la page qui « prend tout l'ecran ». */
let entreeOuverte = null;

function fermer(entree) {
  const detail = entree.querySelector('.hist-detail');
  entree.classList.remove('ouvert');
  detail.style.maxHeight = '0px';
  detail.addEventListener('transitionend', function purge() {
    detail.removeEventListener('transitionend', purge);
    if (!entree.classList.contains('ouvert')) detail.innerHTML = '';
  });
}

function basculer(entree, report) {
  const detail = entree.querySelector('.hist-detail');
  const dejaOuverte = entree === entreeOuverte;

  if (entreeOuverte && entreeOuverte !== entree) fermer(entreeOuverte);

  if (dejaOuverte) {
    fermer(entree);
    entreeOuverte = null;
    return;
  }

  // Rendu partage avec le resultat d'une nouvelle verification (index.html) :
  // voir js/rapport-commun.js, charge avant ce script.
  detail.innerHTML = construireRapportHtml(report);
  entree.classList.add('ouvert');
  // Lu avant l'ecriture de max-height pour forcer un reflow : sans lui, le
  // navigateur regroupe les deux changements et saute directement a la
  // hauteur finale, sans transition.
  void detail.offsetHeight;
  detail.style.maxHeight = detail.scrollHeight + 'px';
  entreeOuverte = entree;
  entree.querySelector('.hist-item').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function chargerHistorique(reinitialiser) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  if (reinitialiser) {
    decalage = 0;
    termine = false;
    entreeOuverte = null;
    $('historique-liste').innerHTML = '';
  }
  if (termine) return;

  $('historique-plus').disabled = true;
  const { data, error } = await supabase
    .from('checks')
    .select('id, device_type, imei_or_serial, verdict, report_data, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .range(decalage, decalage + TAILLE_PAGE - 1);
  $('historique-plus').disabled = false;

  if (error || !data) return;

  if (decalage === 0 && data.length === 0) {
    $('historique-vide').classList.remove('hidden');
    return;
  }
  $('historique-vide').classList.add('hidden');

  decalage += data.length;
  // Une page pleine signifie qu'il y en a peut-etre d'autres ; une page
  // incomplete signifie qu'on a atteint le bout (meme logique que l'app).
  termine = data.length < TAILLE_PAGE;
  $('historique-plus').classList.toggle('hidden', termine);

  for (const item of data) {
    const ton = ['safe', 'warning', 'danger'].includes(item.verdict) ? item.verdict : 'warning';
    const entree = document.createElement('div');
    entree.className = 'hist-entree';
    entree.innerHTML =
      '<div class="hist-item">'
      + `<span class="hist-point hist-${ton}"></span>`
      + '<div class="hist-corps">'
      + `<span class="hist-modele">${echapper(item.report_data?.model || (item.device_type === 'iphone' ? 'iPhone' : 'MacBook'))}</span>`
      + `<span class="hist-meta">${echapper(masquer(item.imei_or_serial))} · ${ilYA(item.created_at)}</span>`
      + '</div>'
      + '<span class="hist-chevron"></span>'
      + '</div>'
      + '<div class="hist-detail"></div>';
    entree.querySelector('.hist-item').addEventListener('click', () => basculer(entree, item.report_data));
    $('historique-liste').appendChild(entree);
  }
}

$('historique-plus').addEventListener('click', () => chargerHistorique(false));
