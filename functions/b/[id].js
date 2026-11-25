// Vitrine publique d'une boutique PhoneScore : https://phonescore.app/b/<id>
// (25 nov. 2026). Ses téléphones en stock, chacun avec son verdict et le lien vers
// son rapport. Même relais que /r/<id> : la page vient de la fonction Supabase
// shared-report (?boutique=<id>), renvoyée en text/html depuis phonescore.app.
// N'expose que ce que la boutique montre déjà dans l'app : nom, lieu, WhatsApp,
// logo ; par téléphone, modèle, verdict et IMEI masqué. Jamais de prix.

const SOURCE = 'https://bvriicetjcnxrbhelokh.supabase.co/functions/v1/shared-report';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENTETES = {
  'content-type': 'text/html; charset=utf-8',
  // img-src : logo de la boutique, servi par le stockage Supabase.
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https://bvriicetjcnxrbhelokh.supabase.co; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-robots-tag': 'noindex, nofollow',
  // Le stock change souvent : une copie de 5 minutes au plus.
  'cache-control': 'public, max-age=300',
};

function pageErreur(message, status) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Boutique PhoneScore</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0D1117;color:#8B949E;text-align:center;padding:48px 20px;">
<div style="font-size:22px;font-weight:bold;color:#fff;margin-bottom:20px;">Phone<span style="color:#2EA043;">Score</span></div>
<p>${message}</p></body></html>`;
  return new Response(html, { status, headers: { ...ENTETES, 'cache-control': 'no-store' } });
}

export async function onRequestGet({ params, request }) {
  const id = String(params.id || '');
  if (!UUID.test(id)) {
    return pageErreur('Lien invalide.', 404);
  }
  const src = (new URL(request.url).searchParams.get('src') || '').toLowerCase().replace(/[^a-z0-9_.:-]/g, '').slice(0, 40);

  let reponse;
  try {
    reponse = await fetch(`${SOURCE}?boutique=${encodeURIComponent(id)}${src ? `&src=${encodeURIComponent(src)}` : ''}`, { headers: { accept: 'text/html' } });
  } catch (e) {
    return pageErreur('La vitrine est momentanément indisponible. Réessayez dans un instant.', 502);
  }
  if (!reponse.ok) {
    return pageErreur('La vitrine est momentanément indisponible. Réessayez dans un instant.', 502);
  }
  return new Response(await reponse.text(), { status: 200, headers: ENTETES });
}
