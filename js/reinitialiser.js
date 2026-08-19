/* Sorti de reinitialiser.html pour que la CSP puisse refuser le script en ligne.
   Ne pas remettre ce code dans la page : script-src vaut 'self'. */
const { createClient } = window.supabase;

  // Cle publique : sans danger cote client (protegee par RLS cote base).
  const SUPABASE_URL = "https://bvriicetjcnxrbhelokh.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_p35a312TC0qA8YDdw_fWAQ_b0AUrfqf";

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const message = document.getElementById("message");
  const bouton = document.getElementById("valider");
  let sessionPrete = false;

  // Le lien Supabase depose un token de recuperation dans le fragment d'URL :
  // le client ouvre alors une session temporaire, seule facon d'autoriser
  // updateUser({ password }).
  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") sessionPrete = true;
  });

  bouton.addEventListener("click", async () => {
    const mdp = document.getElementById("motDePasse").value;
    const confirmation = document.getElementById("confirmation").value;
    message.className = "message";

    if (mdp.length < 8) {
      message.className = "message erreur";
      message.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
      return;
    }
    if (mdp !== confirmation) {
      message.className = "message erreur";
      message.textContent = "Les deux mots de passe ne correspondent pas.";
      return;
    }
    if (!sessionPrete) {
      message.className = "message erreur";
      message.textContent = "Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau depuis l'application.";
      return;
    }

    bouton.disabled = true;
    const { error } = await supabase.auth.updateUser({ password: mdp });
    bouton.disabled = false;

    if (error) {
      message.className = "message erreur";
      message.textContent = "Échec de la mise à jour. Demande un nouveau lien depuis l'application.";
      return;
    }

    message.className = "message succes";
    message.textContent = "Mot de passe modifié ✓ Tu peux retourner dans l'application PhoneScore et te connecter.";
  });
