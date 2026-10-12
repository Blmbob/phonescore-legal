// Base TAC du site (aperçu gratuit), tirée de celle de l'app.
//
// A LANCER APRES TOUTE MISE A JOUR DE constants/tac-database.ts DANS L'APP
// (dépôt phonescore54, à côté de celui-ci) :
//
//   node outils/generer-tac.mjs
//
// Sortie : data/tac.json, compacte — la liste des modèles une seule fois, et
// pour chaque TAC l'indice de son modèle. Chargée par accueil.js seulement
// quand un IMEI complet et valide est saisi, jamais au chargement de la page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.resolve(RACINE, '..', 'phonescore54', 'constants', 'tac-database.ts');

const texte = fs.readFileSync(SOURCE, 'utf8');
// Le nom peut contenir des guillemets échappés (iPad Pro 11\" ...).
const motif = /"(\d{8})":\s*\{\s*model:\s*"((?:[^"\\]|\\.)+)",\s*type:\s*"([a-z]+)"\s*\}/g;

const modeles = [];
const indice = new Map();
const tac = {};
for (const [, code, brut, genre] of texte.matchAll(motif)) {
  const modele = JSON.parse(`"${brut}"`);
  // L'aperçu ne sert que l'onglet iPhone : les iPad restent, ils ont un IMEI.
  if (genre !== 'iphone' && genre !== 'ipad') continue;
  if (!indice.has(modele)) { indice.set(modele, modeles.length); modeles.push(modele); }
  tac[code] = indice.get(modele);
}

const n = Object.keys(tac).length;
if (n < 1000) throw new Error(`Seulement ${n} TAC lus dans ${SOURCE} : format changé ?`);

fs.mkdirSync(path.join(RACINE, 'data'), { recursive: true });
fs.writeFileSync(path.join(RACINE, 'data', 'tac.json'), JSON.stringify({ modeles, tac }));
console.log(`${n} TAC, ${modeles.length} modèles -> data/tac.json`);
