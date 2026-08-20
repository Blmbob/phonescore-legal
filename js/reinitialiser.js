/* Sorti de reinitialiser.html pour que la CSP puisse refuser le script en ligne.
   Ne pas remettre ce code dans la page : script-src vaut 'self'. */

/* Le fragment est lu AVANT de creer le client Supabase : celui-ci consomme le
   jeton et efface le fragment des qu'il s'initialise. Le lire apres reviendrait
   a le trouver vide et a proposer le mauvais formulaire. */
const fragment = window.location.hash || '';
const aUnJeton = /access_token=|type=recovery/.test(fragment);
const lienRefuse = /error=|error_code=/.test(fragment);

const { createClient } = window.supabase;

// Cle publique : sans danger cote client (protegee par RLS cote base).
const SUPABASE_URL = "https://bvriicetjcnxrbhelokh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_p35a312TC0qA8YDdw_fWAQ_b0AUrfqf";

/* Doit figurer dans Supabase -> Authentication -> URL Configuration ->
   Redirect URLs, sinon Supabase ignore la valeur et renvoie vers le Site URL.
   C'est la meme adresse que celle utilisee par l'application
   (constants/legal.ts), pour n'avoir qu'une entree a maintenir. */
const RETOUR = "https://phonescore.app/reinitialiser";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const message = document.getElementById("message");
const etatDemande = document.getElementById("etat-demande");
const etatNouveau = document.getElementById("etat-nouveau");

function afficher(texte, classe) {
  message.textContent = texte;
  message.className = classe ? "message " + classe : "message";
}

// ---------------------------------------------------------------- etat initial
if (aUnJeton) {
  etatNouveau.hidden = false;
} else {
  etatDemande.hidden = false;
  if (lienRefuse) {
    afficher(
      "Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau ci-dessous.",
      "erreur",
    );
  }
}

// ---------------------------------------------------------------- demander un lien
const courriel = document.getElementById("courriel");
const envoyer = document.getElementById("envoyer");

async function demanderLeLien() {
  const adresse = courriel.value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) {
    afficher("Saisis une adresse e-mail valide.", "erreur");
    return;
  }

  envoyer.disabled = true;
  const { error } = await supabase.auth.resetPasswordForEmail(adresse, {
    redirectTo: RETOUR,
  });

  /* Le meme message dans les deux cas, volontairement : repondre « ce compte
     n'existe pas » permettrait a n'importe qui de savoir quelles adresses sont
     inscrites chez toi. Supabase ne le revele pas non plus de son cote. */
  if (error) {
    console.warn("resetPasswordForEmail", error.message);
  }
  afficher(
    "Si un compte existe avec cette adresse, le lien vient d'être envoyé. "
    + "Pense à regarder les indésirables.",
    "succes",
  );
  // Le bouton reste desactive : reappuyer n'enverrait qu'un doublon.
}

envoyer.addEventListener("click", demanderLeLien);
courriel.addEventListener("keydown", (e) => {
  if (e.key === "Enter") demanderLeLien();
});

// ---------------------------------------------------------------- choisir le mot de passe
/* Le lien Supabase depose un token de recuperation dans le fragment d'URL :
   le client ouvre alors une session temporaire, seule facon d'autoriser
   updateUser({ password }). */
let sessionPrete = false;
supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") sessionPrete = true;
});

const valider = document.getElementById("valider");

valider.addEventListener("click", async () => {
  const mdp = document.getElementById("motDePasse").value;
  const confirmation = document.getElementById("confirmation").value;

  if (mdp.length < 8) {
    afficher("Le mot de passe doit contenir au moins 8 caractères.", "erreur");
    return;
  }
  if (mdp !== confirmation) {
    afficher("Les deux mots de passe ne correspondent pas.", "erreur");
    return;
  }
  if (!sessionPrete) {
    /* Le lien est mort : on bascule sur la demande plutot que de renvoyer le
       visiteur vers l'application, qu'il n'a peut-etre pas installee. */
    etatNouveau.hidden = true;
    etatDemande.hidden = false;
    afficher(
      "Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau ci-dessous.",
      "erreur",
    );
    return;
  }

  valider.disabled = true;
  const { error } = await supabase.auth.updateUser({ password: mdp });
  valider.disabled = false;

  if (error) {
    afficher("Échec de la mise à jour. Demande un nouveau lien.", "erreur");
    return;
  }

  afficher("Mot de passe modifié ✓ Tu peux maintenant te connecter.", "succes");
});
