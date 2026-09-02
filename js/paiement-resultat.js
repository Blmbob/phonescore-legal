/* Sorti de payment-result.html pour que la CSP puisse refuser le script en ligne.
   Ne pas remettre ce code dans la page : script-src vaut 'self'. */
var status = new URLSearchParams(window.location.search).get('status') === 'success' ? 'success' : 'error';
  var card = document.getElementById('card');
  card.className = status;
  card.innerHTML = status === 'success'
    ? `<div class="icon">✅</div><h1>${PSI18N.t('paiementResultat.succesTitre')}</h1><p>${PSI18N.t('paiementResultat.succesTexte')}</p>`
    : `<div class="icon">❌</div><h1>${PSI18N.t('paiementResultat.erreurTitre')}</h1><p>${PSI18N.t('paiementResultat.erreurTexte')}</p>`;
