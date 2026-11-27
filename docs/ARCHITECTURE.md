# Hotel Ops — architecture et plan

Nom provisoire. Marché visé : les hôtels et ryokan au Japon.

## Les trois rôles

| Rôle | Compte ? | Ce qu'il fait |
|---|---|---|
| **Client** | Non. Il scanne le QR de la chambre et tape un **code séjour** à 4 chiffres | Faire des demandes, chatter avec le staff (avec traduction) |
| **Staff** | Oui, créé par le director | Voir les chambres à faire, marquer « fait », écrire des commentaires (ménage, consommation, chambre), lire l'historique, répondre aux demandes |
| **Director** | Oui, il s'inscrit lui-même | Tout ce que fait le staff, plus : créer des hôtels, dessiner le plan, créer les chambres et les comptes staff, choisir les modes |

## Un seul QR par chambre

Le QR mène à `https://<site>/r/<code-chambre>`. La page s'adapte à la personne qui la scanne :

- **Pas connecté :** vue client. Il choisit sa langue, tape le code séjour, puis fait ses demandes ou chatte.
- **Connecté en staff ou director de cet hôtel :** vue gestion de la chambre.

### Code séjour

1. À l'arrivée du client, le staff appuie sur « Arrivée client » sur la chambre. Le serveur génère un code à 4 chiffres (le `stayPin`) et un identifiant de séjour (le `stayId`).
2. Le client tape le code une seule fois. Il reçoit un jeton lié à ce `stayId`.
3. Au départ, le staff appuie sur « Départ ». Le `stayId` est effacé, donc tous les jetons de ce séjour deviennent invalides.
4. Protection contre les essais au hasard : après 5 codes faux, la chambre est bloquée 10 minutes.

## Stack (100 % Azure, JavaScript)

| Besoin | Service | Coût |
|---|---|---|
| Site + API | **Azure Static Web Apps** (Free) + Functions gérées (Node, JavaScript) | Gratuit |
| Base de données | **Azure Table Storage** (compte de stockage) | Quelques centimes par mois |
| Chat en temps réel | **Azure Web PubSub** (Free : 20 connexions simultanées, 20 000 messages par jour) | Gratuit |
| Traduction du chat | **Azure AI Translator** (F0 : 2 M caractères par mois) | Gratuit |

Régions : la SWA est en East Asia. Le stockage, Web PubSub et Translator sont en Korea Central, car l'abonnement étudiant bloque Japan East.

Limite à surveiller : le plan Free de Web PubSub accepte 20 connexions en même temps, staff et clients compris. Pour un vrai hôtel, il faudra le plan Standard, payant.

En local, **Azurite** émule Table Storage, sans Docker.

Front : JavaScript simple avec **Vite**, sans framework. Un petit routeur et un petit helper `h()` pour créer le DOM, ce qui évite `innerHTML` et donc les injections XSS.

Pourquoi Table Storage plutôt que Cosmos DB ? Toutes les données d'un hôtel se lisent par clé (hôtel → chambres, chambre → historique), donc pas besoin de requêtes complexes. Et Table Storage tourne en local sans Docker.

### Comptes staff et director

On gère l'authentification nous-mêmes :
- le mot de passe est haché avec `scrypt` (inclus dans Node) ;
- le jeton est signé avec HMAC et envoyé dans l'en-tête `x-hotel-token` (pas `Authorization`, que SWA peut réécrire).

Le staff se connecte avec un **identifiant** créé par le director. Pas besoin d'e-mail, beaucoup d'employés n'en donnent pas.

## Modèle de données (tables)

| Table | PartitionKey | RowKey | Contenu |
|---|---|---|---|
| `users` | `user` | identifiant (en minuscules) | hash, rôle, nom, `hotelId` (pour le staff) |
| `hotels` | `hotel` | hotelId | nom, ownerId, réglages (`timingMode`), plan (JSON) |
| `rooms` | hotelId | roomId | numéro, étage, code QR, statut, dernier ménage, séjour en cours |
| `roomcodes` | `code` | code QR | hotelId, roomId (pour retrouver la chambre depuis le QR) |
| `events` | roomId | horodatage inversé | historique : ménages, commentaires, consommations |
| `requests` | hotelId | horodatage inversé | demandes des clients (texte libre traduit dans `tr`) |
| `messages` | stayId | horodatage croissant | chat d'un séjour : texte d'origine, langue détectée, traductions (`tr`) |

L'horodatage inversé (`9999999999999 - Date.now()`) fait sortir les éléments les plus récents en premier. Le chat utilise l'ordre croissant, pour lire le fil du plus ancien au plus récent.

## Chat et traduction

- Un fil par **séjour** (`stayId`). Au départ du client, le séjour change, donc le fil n'est plus visible ni pour le client ni pour le staff de la chambre.
- La traduction se fait **une seule fois, à l'envoi**, et elle est enregistrée avec le message :
  - un message du client est traduit en japonais, anglais et français, les langues du staff ;
  - un message du staff est traduit dans la langue du client, et aussi en ja/en/fr pour les autres employés.
- Translator détecte la langue réellement écrite. Si un client a choisi l'anglais mais écrit en chinois, la traduction reste juste.
- Chacun voit le message dans sa langue, avec un bouton « original ». Une erreur de traduction se repère toujours.
- Si Translator ne répond pas, le message part quand même, sans traduction.

## Temps réel

- **Web PubSub** envoie de petits signaux : `message`, `request`, `room`, `stay_end`. La page recharge alors ce qui a changé par l'API. Aucune donnée ne passe par le WebSocket, donc les droits restent vérifiés par l'API.
- Deux types de groupes :
  - `hotel.<id>` pour le staff de l'hôtel ;
  - `stay.<id>` pour le client d'un séjour.
- Le jeton WebSocket donné au navigateur n'a **aucun droit** d'envoi ni de changement de groupe : il écoute seulement.
- Il expire après 2 h. La page se reconnecte alors toute seule, et aussi au retour sur l'onglet.
- Si Web PubSub n'est pas configuré, les pages se rafraîchissent toutes les 15 à 20 secondes.

## Langues

- Staff et director : 日本語 (par défaut), EN, FR. Le japonais est choisi sauf si le navigateur est en français ou en anglais.
- Client : FR, EN, JA, 中文, 한국어, ES, DE.

## Phases

1. **Fondations** ✅ : inscription director, connexion, hôtels, chambres (création en série « 101-120 »), comptes staff, QR imprimables, page `/r/:code` qui change selon le rôle.
2. **Vue staff** ✅ (version de base) : à faire / en cours / fait, dernière fois, commentaires par type, historique, arrivée et départ du client.
3. **Client** ✅ : demandes, chat temps réel avec le staff (Web PubSub), traduction automatique dans les deux sens (Translator).
4. **Éditeur de plan** : grille vue de haut, pinceaux (moquette, carrelage, mur, porte), chambres posées sur la grille, plusieurs étages. Le plan devient le tableau de bord, chaque chambre colorée selon son état.
5. **Mode chronométré** : scan au début, scan à la fin, puis « facile / normal / difficile ». Temps moyen par chambre et par employé.
6. **App iPhone** : plus tard, avec la même API.
