/* Sorti de payment-result.html pour que la CSP puisse refuser le script en ligne.
   Ne pas remettre ce code dans la page : script-src vaut 'self'. */
var status = new URLSearchParams(window.location.search).get('status') === 'success' ? 'success' : 'error';
  var card = document.getElementById('card');
  card.className = status;
  card.innerHTML = status === 'success'
    ? '<div class="icon">✅</div><h1>Paiement reçu</h1><p>Tu peux fermer cette fenêtre et retourner dans l\'application PhoneScore.</p>'
    : '<div class="icon">❌</div><h1>Paiement annulé</h1><p>Le paiement a été annulé ou a échoué. Tu peux fermer cette fenêtre et réessayer dans l\'application.</p>';
