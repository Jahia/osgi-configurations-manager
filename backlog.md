# Backlog UI Jahia

Ce document sert de fil conducteur pour la refonte progressive de l'UI afin de la rapprocher du style Jahia/Moonstone, tout en gardant des étapes testables entre chaque lot.

Contraintes à garder en tête pendant tout le chantier :

- s'appuyer sur les maquettes du dossier `FigmaScreenshots`
- vérifier les composants/props/variables dans `/Users/dgigon/Tickets/CUSTOMERS/SOURCES_JAHIA/moonstone` quand nécessaire
- éviter la duplication de code pour rester compatible avec `mvn clean install sonar:sonar`
- conserver ou stabiliser les sélecteurs `data-cy` utiles pendant la refonte
- avancer par petits lots validables manuellement et via Cypress

## Ordre recommandé

1. Lot 0 - Stabilisation des tests
2. Lot 1 - Socle UI Jahia/Moonstone partagé
3. Lot 2 - Refonte de la sidebar
4. Lot 3 - Refonte du header du panneau droit
5. Lot 4 - Badges et banners d'état
6. Lot 5 - Vue visuelle `.cfg`
7. Lot 7 - Modal de création de configuration
8. Lot 8 - Actions destructives et confirmations
9. Lot 6 - Vue raw `.cfg` et `.yml`
10. Lot 9 - Consolidation Sonar et couverture finale

## Lot 0 - Stabilisation des tests

Objectif :
sécuriser la base avant la refonte visuelle.

Périmètre :

- remettre à plat les tests Cypress existants
- extraire les helpers répétitifs
- figer les sélecteurs `data-cy` qu'on veut conserver

Fichiers pressentis :

- `tests/cypress/e2e/01-Tests.cy.ts`
- `tests/cypress/support/commands.js`
- nouveaux specs éventuels dans `tests/cypress/e2e`

Travail prévu :

- découper le spec monolithique en specs orientés usage
- factoriser les actions communes `open`, `create`, `delete`, `switch mode`, `assert toast`
- identifier les sélecteurs stables à ne pas casser pendant les lots UI

Risque Sonar :

- duplication probable dans les scénarios CRUD et les assertions répétées
- à traiter par quelques helpers Cypress ciblés, sans sur-abstraction

Validation :

- toute la suite existante passe sans changement fonctionnel

## Lot 1 - Socle UI Jahia/Moonstone partagé

Objectif :
préparer une base de styles et helpers partagés avant les changements visuels importants.

Périmètre :

- supprimer progressivement les couleurs hardcodées
- centraliser les patterns visuels répétés

Fichiers pressentis :

- `src/javascript/osgiConfigManager/App/index.jsx`
- `src/javascript/osgiConfigManager/App/components/FileSidebar.jsx`
- `src/javascript/osgiConfigManager/App/components/CfgEditor.jsx`
- `src/javascript/osgiConfigManager/App/components/Dialogs.jsx`
- nouveau fichier utilitaire du type `uiTokens` ou `uiStyles`

Travail prévu :

- remplacer les couleurs `#...` par des variables Moonstone
- centraliser les styles répétés de header, panneaux, toolbars, banners et overlays
- vérifier les composants et variables disponibles dans le clone Moonstone

Risque Sonar :

- fort risque de duplication si chaque composant garde ses styles inline copiés
- extraction précoce des styles et helpers recommandée

Validation :

- chargement de l'application
- navigation entre fichiers
- save toujours opérationnel

## Lot 2 - Refonte de la sidebar

Objectif :
rapprocher la colonne gauche des maquettes et clarifier la liste des fichiers.

Périmètre :

- toolbar de la sidebar
- recherche
- lignes de fichiers
- troncature et hover

Fichiers pressentis :

- `src/javascript/osgiConfigManager/App/components/FileSidebar.jsx`
- `src/javascript/osgiConfigManager/App/components/ConfigStateBadge.jsx` si besoin

Travail prévu :

- retravailler la structure visuelle de la sidebar
- gérer proprement la troncature des noms de fichiers
- aligner les badges
- corriger le hover des noms complets
- vérifier si certaines actions doivent être remontées selon la maquette

Risque Sonar :

- duplication possible entre tooltip custom de la sidebar et overlays d'autres écrans
- viser un pattern partagé pour les textes tronqués

Validation :

- sélection d'un fichier
- nom long tronqué mais lisible au hover
- recherche et deep search inchangés

Tests Cypress à prévoir ou adapter :

- sidebar visible
- fichier long tronqué visuellement
- hover affichant le nom complet
- badge visible sur chaque ligne

## Lot 3 - Refonte du header du panneau droit

Objectif :
revoir la hiérarchie visuelle du panneau droit sans toucher encore au cœur des éditeurs.

Périmètre :

- titre du fichier
- chemin
- badge
- actions principales et secondaires

Fichiers pressentis :

- `src/javascript/osgiConfigManager/App/index.jsx`

Travail prévu :

- mieux hiérarchiser `selectedFile.name` et `selectedFile.path`
- utiliser `Typography` avec `isNowrap` quand pertinent
- repositionner `Save`, `Delete`, `Mark as default`, `Visual/Raw`
- conserver les `data-cy` critiques

Risque Sonar :

- duplication possible avec d'autres toolbars si les boutons sont reconstruits à l'identique
- extraction d'un petit composant `ActionBar` à envisager si utile

Validation :

- fichier sélectionné visible
- save toujours accessible
- mode raw/visual inchangé

Tests Cypress à prévoir ou adapter :

- titre sélectionné affiché
- changement raw/visual fonctionnel
- `Save` activé ou désactivé selon l'état

## Lot 4 - Badges et banners d'état

Objectif :
aligner les badges sur le style Jahia et corriger le bug de tooltip tronqué.

Périmètre :

- badges `MODULE`, `MODULE_DEFAULT`, `USER`
- banners de contexte dans le panneau droit

Fichiers pressentis :

- `src/javascript/osgiConfigManager/App/components/ConfigStateBadge.jsx`
- `src/javascript/osgiConfigManager/App/index.jsx`
- fichiers de locales si libellés à ajuster

Travail prévu :

- remplacer le badge custom par `Chip`
- ajouter les icônes `default / local / module` si disponibles
- corriger le tooltip du badge
- décider si le tooltip de droite reste nécessaire quand un banner est déjà affiché

Risque Sonar :

- faible si un composant badge unique est réutilisé partout
- plus élevé si les rendus compact et standard divergent trop

Validation :

- états `MODULE`, `MODULE_DEFAULT`, `USER`
- rendu cohérent en sidebar et en header

Tests Cypress à prévoir ou adapter :

- badge correct selon l'état
- banner affiché au bon moment
- tooltip complet si conservé

## Lot 5 - Vue visuelle `.cfg`

Objectif :
rapprocher la vue table de `VisualEdit.png` et améliorer l'édition.

Périmètre :

- tableau des propriétés
- toolbar de la vue visuelle
- commentaires et lignes vides
- largeur des colonnes

Fichiers pressentis :

- `src/javascript/osgiConfigManager/App/components/CfgEditor.jsx`

Travail prévu :

- mettre `Property / Key` et `Value` à taille équivalente
- revoir la place des actions `Add property`, `comments`, `empty lines`
- décider du comportement cible des commentaires et lignes vides
- recommandation actuelle : support conservé, mais masqué par défaut en vue table

Risque Sonar :

- élevé car le fichier est déjà dense
- probable extraction de sous-composants de ligne, toolbar et overlay

Validation :

- ajout de propriété
- édition clé/valeur
- suppression
- chiffrement
- drag and drop inchangé

Tests Cypress à prévoir ou adapter :

- ajout de propriété et save
- colonnes property/value présentes et équilibrées
- toggle comments / empty lines
- suppression d'une ligne

## Lot 6 - Vue raw `.cfg` et `.yml`

Objectif :
aligner les actions de l'éditeur raw avec la maquette sans casser l'assistance metatype.

Périmètre :

- toolbar Monaco
- bannières de contexte
- bascule raw/visual

Fichiers pressentis :

- `src/javascript/osgiConfigManager/App/components/MonacoEditor.jsx`
- `src/javascript/osgiConfigManager/App/components/Editor.jsx`
- `src/javascript/osgiConfigManager/App/index.jsx`

Travail prévu :

- repositionner les actions selon le pattern Jahia
- harmoniser les toolbars
- vérifier la cohabitation avec les banners d'état

Risque Sonar :

- duplication possible entre actions raw et visual
- si possible, partager une logique d'actions haut niveau plutôt que dupliquer le rendu

Validation :

- switch raw/visual
- édition raw
- assistance metatype YAML

Tests Cypress à prévoir ou adapter :

- bascule raw/visual
- ajout de propriété assistée en raw
- save après modification raw

## Lot 7 - Modal de création de configuration

Objectif :
traiter séparément le changement le plus structurant côté UI.

Périmètre :

- modal de création
- tabs `Manual / Configuration / Factory`
- footer d'actions
- overlay

Fichiers pressentis :

- `src/javascript/osgiConfigManager/App/components/Dialogs.jsx`
- appelants dans `src/javascript/osgiConfigManager/App/index.jsx`

Travail prévu :

- utiliser un vrai `Modal` Moonstone
- supprimer le blur de l'overlay
- utiliser des boutons Moonstone dans le footer
- remplacer les tabs custom par des `Tabs`
- conserver les 3 modes existants

Risque Sonar :

- élevé si la logique actuelle reste entremêlée avec un nouveau rendu
- mieux vaut séparer logique métier et rendu des onglets

Validation :

- create manual
- create from metatype
- create factory
- cancel

Tests Cypress à prévoir ou adapter :

- navigation entre onglets
- état disabled/enabled du bouton create
- erreur sur identifiant factory déjà existant
- fermeture sans création

## Lot 8 - Actions destructives et confirmations

Objectif :
isoler les changements de wording et de style sur les actions sensibles.

Périmètre :

- suppression de fichier
- confirmations
- cohérence visuelle des actions destructives

Fichiers pressentis :

- `src/javascript/osgiConfigManager/App/components/Dialogs.jsx`
- `src/javascript/osgiConfigManager/App/components/FileSidebar.jsx`
- potentiellement la logique dans `useOsgiConfigs`

Travail prévu :

- bouton `Delete` au lieu de `OK`
- couleur rouge
- confirmation de suppression plus explicite
- cohérence avec confirmations unsaved et disable/enable

Risque Sonar :

- faible si un seul composant de confirmation est réutilisé

Validation :

- suppression confirmée
- suppression annulée
- toggle enabled/disabled inchangé

Tests Cypress à prévoir ou adapter :

- bouton delete rouge et libellé correct
- annulation sans effet
- suppression effective après confirmation

## Lot 9 - Consolidation Sonar et couverture finale

Objectif :
fermer la refonte avec une base propre, factorisée et suffisamment couverte.

Périmètre :

- nettoyage des duplications résiduelles
- revue finale de la couverture
- passage Sonar

Fichiers pressentis :

- tous les composants touchés
- tests Jest/Cypress concernés

Travail prévu :

- extraire les helpers et composants communs restants
- supprimer les styles inline dupliqués restants
- centraliser constantes et patterns répétés
- exécuter `mvn clean install sonar:sonar`

Validation :

- build OK
- tests OK
- analyse Sonar sans nouveau point bloquant majeur

## Notes produit à trancher pendant l'avancement

- faut-il conserver un tooltip sur le badge de droite si un banner de contexte est déjà affiché ?
- faut-il masquer par défaut commentaires et lignes vides en vue table `.cfg` ?
- quelles actions doivent rester en header global et lesquelles doivent vivre dans l'éditeur ?
- quelles icônes Moonstone retenir pour `default / local / module` ?

## Rappel important pour chaque lot

Avant de clôturer un lot :

- vérifier manuellement le scénario principal
- adapter ou ajouter les tests Cypress liés au périmètre
- vérifier qu'aucune duplication évidente n'a été introduite
- garder les changements limités au périmètre du lot
