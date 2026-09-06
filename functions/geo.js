// Fonction Cloudflare Pages (pas un Worker séparé -- Pages en déploie un
// automatiquement pour tout fichier sous functions/, sans infra en plus).
// cf-ipcountry est un en-tête que Cloudflare pose sur chaque requête entrante,
// gratuit, mais invisible du JS client : il ne voyage que jusqu'ici, côté
// serveur. Utilisée par js/accueil.js pour renseigner profiles.signup_country.
export function onRequestGet({ request }) {
  const country = request.headers.get('cf-ipcountry') || null;
  return new Response(JSON.stringify({ country }), {
    headers: { 'content-type': 'application/json' },
  });
}
