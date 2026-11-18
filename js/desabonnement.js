/* Désinscription des e-mails de campagne PhoneScore (desabonnement.html).
   Sorti de la page : script-src vaut 'self'. Textes dans les 4 langues des e-mails
   (fr, en, es, ar), lue dans le lien (?l=) ; ce n'est pas une page du site traduite
   par js/i18n.js (qui ne connaît que fr et en).

   Le lien contient l'identifiant du compte (u) et sa signature (s) : sans la bonne
   signature, la fonction refuse. Rien n'est envoyé avant le clic sur le bouton. */

(function () {
  var FONCTION = 'https://bvriicetjcnxrbhelokh.supabase.co/functions/v1/unsubscribe';

  var TEXTES = {
    fr: {
      titre: 'Se désinscrire des e-mails PhoneScore',
      texte: "Tu ne recevras plus d'e-mails d'information ou de nouveautés. Les e-mails liés à ton compte (mot de passe, confirmation) restent possibles.",
      bouton: 'Me désinscrire',
      encours: 'Un instant…',
      faitTitre: 'C’est fait',
      faitTexte: "Tu ne recevras plus d'e-mails de campagne de PhoneScore.",
      invalide: 'Ce lien est invalide ou incomplet. Utilise le lien reçu dans l’e-mail.',
      erreur: 'La désinscription n’a pas pu être enregistrée. Réessaie dans un instant.',
    },
    en: {
      titre: 'Unsubscribe from PhoneScore emails',
      texte: 'You will no longer receive news or update emails. Account-related emails (password, confirmation) may still be sent.',
      bouton: 'Unsubscribe me',
      encours: 'One moment…',
      faitTitre: 'Done',
      faitTexte: 'You will no longer receive PhoneScore campaign emails.',
      invalide: 'This link is invalid or incomplete. Please use the link from the email.',
      erreur: 'Your unsubscribe request could not be saved. Please try again in a moment.',
    },
    es: {
      titre: 'Darse de baja de los correos de PhoneScore',
      texte: 'Ya no recibirás correos de novedades. Los correos relacionados con tu cuenta (contraseña, confirmación) pueden seguir llegando.',
      bouton: 'Darme de baja',
      encours: 'Un momento…',
      faitTitre: 'Listo',
      faitTexte: 'Ya no recibirás correos de campaña de PhoneScore.',
      invalide: 'Este enlace no es válido o está incompleto. Usa el enlace del correo.',
      erreur: 'No se pudo registrar la baja. Vuelve a intentarlo en un momento.',
    },
    ar: {
      titre: 'إلغاء الاشتراك في رسائل PhoneScore',
      texte: 'لن تصلك بعد الآن رسائل الأخبار والتحديثات. قد تصلك الرسائل المتعلقة بحسابك (كلمة المرور، التأكيد).',
      bouton: 'إلغاء اشتراكي',
      encours: 'لحظة…',
      faitTitre: 'تم',
      faitTexte: 'لن تصلك بعد الآن رسائل PhoneScore الترويجية.',
      invalide: 'هذا الرابط غير صالح أو غير مكتمل. استخدم الرابط الموجود في الرسالة.',
      erreur: 'تعذّر تسجيل إلغاء الاشتراك. أعد المحاولة بعد قليل.',
    },
  };

  var q = new URLSearchParams(location.search);
  var u = q.get('u') || '';
  var s = q.get('s') || '';
  var l = TEXTES[q.get('l')] ? q.get('l') : 'fr';
  var t = TEXTES[l];

  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';

  var carte = document.getElementById('carte');
  var titre = document.getElementById('titre');
  var texte = document.getElementById('texte');
  var bouton = document.getElementById('bouton');

  function afficher(classe, h1, p) {
    carte.className = 'card ' + classe;
    titre.textContent = h1;
    texte.textContent = p;
    bouton.classList.add('hidden');
  }

  // Même forme que ce que la fonction accepte : identifiant de compte et signature hexadécimale.
  if (!/^[0-9a-f-]{36}$/i.test(u) || !/^[0-9a-f]{64}$/i.test(s)) {
    afficher('erreur', t.titre, t.invalide);
    return;
  }

  titre.textContent = t.titre;
  texte.textContent = t.texte;
  bouton.textContent = t.bouton;
  bouton.classList.remove('hidden');

  bouton.addEventListener('click', function () {
    bouton.disabled = true;
    bouton.textContent = t.encours;
    var adresse = FONCTION + '?u=' + encodeURIComponent(u) + '&s=' + encodeURIComponent(s) + '&l=' + encodeURIComponent(l);
    fetch(adresse, { method: 'POST' })
      .then(function (r) {
        if (r.ok) afficher('fait', t.faitTitre, t.faitTexte);
        else if (r.status === 400) afficher('erreur', t.titre, t.invalide);
        else throw new Error('HTTP ' + r.status);
      })
      .catch(function () {
        bouton.disabled = false;
        bouton.textContent = t.bouton;
        texte.textContent = t.erreur;
      });
  });
})();
