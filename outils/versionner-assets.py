# -*- coding: utf-8 -*-
"""Colle une empreinte de contenu aux adresses des fichiers js/ et css/.

À LANCER AVANT CHAQUE DÉPLOIEMENT QUI TOUCHE UN FICHIER DE js/ OU css/ :

    python outils/versionner-assets.py

Pourquoi c'est nécessaire — Cloudflare Pages impose 4 heures de cache
navigateur aux ressources statiques, et refuse qu'on raccourcisse ce délai
depuis `_headers` (vérifié : une valeur plus longue est acceptée, `max-age=0`
non). Le HTML, lui, est revalidé à chaque visite. Après un déploiement qui
touche les deux, un visiteur déjà venu reçoit donc du HTML neuf avec du
script périmé, et la page casse sans la moindre erreur.

Comme on ne peut pas raccourcir le cache, on change l'adresse : `menu.js`
devient `menu.js?v=1a2b3c4d`, où l'empreinte suit le contenu. Un fichier
modifié a une nouvelle adresse, que le navigateur ne peut pas avoir en cache.
Un fichier inchangé garde la sienne et reste mis en cache — c'est le but.

Le script est idempotent : le relancer sans avoir rien modifié ne change
rien.
"""
import hashlib
import io
import os
import re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# `?v=` deja present ou non, on le remplace
MOTIF = re.compile(r'(?P<attr>href|src)="(?P<chemin>/(?:js|css)/[A-Za-z0-9._-]+)(?:\?v=[0-9a-f]+)?"')


def empreinte(chemin_relatif):
    chemin = os.path.join(RACINE, chemin_relatif.lstrip('/'))
    if not os.path.exists(chemin):
        raise SystemExit('RESSOURCE INTROUVABLE : ' + chemin_relatif)
    with open(chemin, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:8]


total = 0
pages_touchees = []

for nom in sorted(os.listdir(RACINE)):
    if not nom.endswith('.html'):
        continue
    chemin = os.path.join(RACINE, nom)
    source = io.open(chemin, encoding='utf-8').read()

    compte = [0]

    def remplacer(m):
        v = empreinte(m.group('chemin'))
        compte[0] += 1
        return '%s="%s?v=%s"' % (m.group('attr'), m.group('chemin'), v)

    reecrit = MOTIF.sub(remplacer, source)

    if reecrit != source:
        io.open(chemin, 'w', encoding='utf-8', newline='').write(reecrit)
        pages_touchees.append(nom)
    total += compte[0]
    if compte[0]:
        print('  %-24s %d ressource(s)' % (nom, compte[0]))

print()
print('%d références versionnées, %d page(s) modifiée(s)'
      % (total, len(pages_touchees)))
if not pages_touchees:
    print('(rien à changer — les empreintes étaient déjà à jour)')
