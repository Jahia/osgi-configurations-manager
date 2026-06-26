# AGENTS

## Jahia

- Les sources Jahia sont disponibles dans `/Users/dgigon/Tickets/CUSTOMERS/SOURCES_JAHIA`.
- Quand tu analyses ces sources, fais un `git pull` de temps en temps pour récupérer les dernières versions locales avant de conclure.
- Si une instance Jahia tourne en local, elle est lancée de l'une des deux façons suivantes :
  - via Java, avec l'utilisateur `root` et le mot de passe `welcome1`
  - via Docker, avec l'utilisateur `root` et le mot de passe `root1234`
- Pour travailler sur la bonne version dans les sources :
  - dans `jahia-private`, utiliser un checkout de la forme `JAHIA_8_X_X_X`
  - dans les modules comme `jcontent`, utiliser un checkout de la forme `X_X_X`
- Si des sources nécessaires sont manquantes dans `/Users/dgigon/Tickets/CUSTOMERS/SOURCES_JAHIA`, demander à l'utilisateur de les ajouter.

## GitHub

- Quand tu rédiges une pull request ou un commentaire long, évite les chaînes avec `\n` littéraux.
- Utilise un heredoc ou un fichier de corps (`--body-file`) pour conserver les vrais retours à la ligne.
