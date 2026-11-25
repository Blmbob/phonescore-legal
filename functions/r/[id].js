// Rapport partagé par le QR code des factures PhoneScore : https://phonescore.app/r/<id>
//
// Pourquoi ce relais (18 nov. 2026) -- le QR pointait directement sur la fonction
// Supabase shared-report. Or Supabase réécrit le Content-Type des réponses HTML de
// *.supabase.co en text/plain : le client qui scannait le code voyait le code source
// de la page au lieu du rapport. Ce relais demande la même page à shared-report et la
// renvoie en text/html depuis phonescore.app.
//
// Rien d'autre ne transite : shared-report n'affiche déjà que le verdict, le modèle,
// l'IMEI masqué, la date et le nom de la boutique (jamais d'identifiant de compte).
// Les en-têtes de _headers ne s'appliquent pas aux réponses des fonctions Pages :
// ceux de sécurité sont donc posés ici. La page n'a que des styles en ligne, aucun
// script ni image : la politique de sécurité n'autorise que cela.

const SOURCE = 'https://bvriicetjcnxrbhelokh.supabase.co/functions/v1/shared-report';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENTETES = {
  'content-type': 'text/html; charset=utf-8',
  // form-action 'self' : le formulaire de notation de la boutique (25 nov. 2026)
  // se renvoie à cette même adresse, en POST.
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  // Un rapport de vérification n'a rien à faire dans un moteur de recherche.
  'x-robots-tag': 'noindex, nofollow',
  // Le verdict peut être mis à jour (rapport complété) : jamais de copie en cache.
  'cache-control': 'no-store',
};

function pageErreur(message, status) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rapport PhoneScore</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0D1117;color:#8B949E;text-align:center;padding:48px 20px;">
<div style="font-size:22px;font-weight:bold;color:#fff;margin-bottom:20px;">Phone<span style="color:#2EA043;">Score</span></div>
<p>${message}</p></body></html>`;
  return new Response(html, { status, headers: ENTETES });
}

export async function onRequestGet({ params, request }) {
  const id = String(params.id || '');
  // ?src=annonce (texte d'annonce de l'app) ou ?src=facture (QR des factures) :
  // transmis pour que le bouton de la page vers le site garde la source.
  const src = (new URL(request.url).searchParams.get('src') || '').toLowerCase().replace(/[^a-z0-9_.:-]/g, '').slice(0, 40);
  if (!UUID.test(id)) {
    return pageErreur('Lien invalide.', 404);
  }

  let reponse;
  try {
    reponse = await fetch(`${SOURCE}?id=${encodeURIComponent(id)}${src ? `&src=${encodeURIComponent(src)}` : ''}`, { headers: { accept: 'text/html' } });
  } catch (e) {
    return pageErreur('Le rapport est momentanément indisponible. Réessayez dans un instant.', 502);
  }
  if (!reponse.ok) {
    return pageErreur('Le rapport est momentanément indisponible. Réessayez dans un instant.', 502);
  }

  return new Response(await reponse.text(), { status: 200, headers: ENTETES });
}

// Avis de l'acheteur sur la boutique : le formulaire de la page est relayé tel
// quel (note, commentaire, champ piège) ; shared-report valide et enregistre.
export async function onRequestPost({ params, request }) {
  const id = String(params.id || '');
  if (!UUID.test(id)) {
    return pageErreur('Lien invalide.', 404);
  }
  const src = (new URL(request.url).searchParams.get('src') || '').toLowerCase().replace(/[^a-z0-9_.:-]/g, '').slice(0, 40);
  const corps = (await request.text()).slice(0, 4000);
  let reponse;
  try {
    reponse = await fetch(`${SOURCE}?id=${encodeURIComponent(id)}${src ? `&src=${encodeURIComponent(src)}` : ''}`, {
      method: 'POST',
      headers: { accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded' },
      body: corps,
    });
  } catch (e) {
    return pageErreur("L'avis n'a pas pu être envoyé. Réessayez dans un instant.", 502);
  }
  if (!reponse.ok) {
    return pageErreur("L'avis n'a pas pu être envoyé. Réessayez dans un instant.", 502);
  }
  return new Response(await reponse.text(), { status: 200, headers: ENTETES });
}
