/* Source de campagne : premier contact gagnant. ?src=... (ou utm_campaign), sinon le site
   d'origine quand il est externe. Conserve dans le navigateur, envoye au serveur a la
   connexion (accueil.js -> set_signup_campaign). Rien ne casse si le stockage est refuse. */
(function () {
  try {
    if (localStorage.getItem('ps_campaign')) return;
    var q = new URLSearchParams(location.search);
    var v = q.get('src') || q.get('utm_campaign') || '';
    if (!v && document.referrer) {
      var h = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (h && h.indexOf('phonescore.app') === -1) v = 'ref.' + h;
    }
    v = v.toLowerCase().replace(/[^a-z0-9_.:-]/g, '').slice(0, 60);
    if (v) localStorage.setItem('ps_campaign', v);
  } catch (e) {}
})();
/* Sorti de la barre de chaque page pour que la CSP puisse refuser le script en ligne.
   Ne pas remettre ce code dans la page : script-src vaut 'self'. */
/* Menu de la barre. Volontairement sans dependance et en fin de page :
   la navigation doit tenir meme si le reste du script echoue. */
(function () {
  var bouton = document.getElementById('menu-bouton');
  var menu = document.getElementById('menu');
  if (!bouton || !menu) return;

  function afficher(ouvert) {
    bouton.setAttribute('aria-expanded', String(ouvert));
    menu.hidden = !ouvert;
  }

  bouton.addEventListener('click', function (e) {
    e.stopPropagation();
    afficher(menu.hidden);
  });

  /* Un panneau qui ne se referme qu'en revenant sur le bouton gene sur
     mobile, ou il couvre justement ce qu'on voulait lire. */
  document.addEventListener('click', function (e) {
    if (!menu.hidden && !menu.contains(e.target)) afficher(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menu.hidden) {
      afficher(false);
      bouton.focus();
    }
  });
})();
