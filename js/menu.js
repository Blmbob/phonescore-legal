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
