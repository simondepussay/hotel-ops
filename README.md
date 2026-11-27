# Hotel Ops

Web app de gestion d'hôtel pensée pour le Japon (hôtels, ryokan). Un **seul QR code par chambre** :

- le **client** le scanne sans compte, tape son code séjour, puis fait des demandes (serviettes, ménage, produits, problème) et **chatte avec le staff** dans sa langue : les messages sont traduits automatiquement dans les deux sens ;
- le **staff**, connecté, scanne le même QR et arrive sur la gestion de la chambre : à faire / fait, dernier ménage, commentaires, consommations, historique, arrivée et départ du client ;
- le **director** crée l'hôtel, les chambres, les comptes staff, imprime les QR et active le **mode chronométré** (scan au début et à la fin du ménage, puis difficulté).

Langues : staff et director en 日本語 (par défaut), English, Français ; client en 日本語, English, 中文, 한국어, Français, Español, Deutsch.

Architecture et plan des phases : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

En ligne : https://orange-coast-0d9dde800.5.azurestaticapps.net

## Stack

- Front : JavaScript simple + Vite (`app/`)
- API : Azure Functions v4, Node, JavaScript (`api/`)
- Données : Azure Table Storage (Azurite en local)
- Temps réel : Azure Web PubSub (le serveur envoie, les navigateurs écoutent)
- Traduction : Azure AI Translator
- Hébergement : Azure Static Web Apps

## Lancer en local

Il faut Node 20 ou plus récent et [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local).

```bash
npm run setup   # installe tout et crée api/local.settings.json
npm run dev     # Azurite + API (7071) + site (5180)
```

Ensuite, ouvrir http://localhost:5180, créer un compte director, puis un hôtel et des chambres.

Sans clés Translator et Web PubSub dans `api/local.settings.json`, tout marche quand même : les messages ne sont pas traduits, et les pages se rafraîchissent toutes les 15 à 20 secondes au lieu d'être en temps réel.

Pour tester le client et le staff en même temps sur un ordinateur, ouvrir le staff sur `localhost:5180` et le client sur `127.0.0.1:5180`. Ce sont deux origines différentes, donc la connexion staff n'est pas partagée.

Pour tester sur un téléphone, il doit être sur le même Wi-Fi. Ouvrir l'adresse « Network » affichée par Vite. Les QR imprimés pointent vers l'adresse utilisée au moment de l'impression.

## Déploiement (Azure)

| Ressource | Nom | Région |
|---|---|---|
| Groupe de ressources | `rg-hotel-ops` | Japan East (métadonnées seulement) |
| Static Web App (Free) | `hotel-ops` | East Asia |
| Compte de stockage (Table Storage) | `hotelops76bb47` | Korea Central |
| Web PubSub (Free) | `hotelops-pubsub` | Korea Central |
| Translator (F0, 2 M caractères par mois) | `hotelops-translator` | Korea Central |

L'abonnement étudiant n'autorise pas Japan East pour les ressources. Korea Central est donc la région autorisée la plus proche du Japon.

L'API lit ces réglages, définis dans la Static Web App et jamais versionnés :
- `TABLES_CONNECTION` : chaîne de connexion du compte de stockage ;
- `AUTH_SECRET` : secret aléatoire qui signe les jetons ;
- `WEBPUBSUB_CONNECTION` : chaîne de connexion de Web PubSub (optionnel : sans elle, pas de temps réel) ;
- `TRANSLATOR_KEY` et `TRANSLATOR_REGION` : clé et région de Translator (optionnels : sans eux, pas de traduction).

Chaque push sur `main` déclenche [.github/workflows/deploy.yml](.github/workflows/deploy.yml). Le workflow a besoin du secret GitHub `AZURE_STATIC_WEB_APPS_API_TOKEN`, qui est le jeton de déploiement de la SWA.

Déploiement manuel, si besoin :

```bash
npm run build
npx @azure/static-web-apps-cli deploy ./app/dist --api-location ./api --api-language node --api-version 20 \
  --deployment-token "$(az staticwebapp secrets list -n hotel-ops -g rg-hotel-ops --query properties.apiKey -o tsv)" --env production
```
