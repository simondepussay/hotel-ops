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
| Chat en temps réel | **Azure Web PubSub** (Free : 20 connexions) | Gratuit au début, phase 3 |
| Traduction du chat | **Azure AI Translator** (F0 : 2 M caractères par mois) | Gratuit au début, phase 3 |

Régions : la SWA est en East Asia ; le stockage est en Korea Central, car l'abonnement étudiant bloque Japan East.

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
| `requests` | hotelId | horodatage inversé | demandes des clients |

L'horodatage inversé (`9999999999999 - Date.now()`) fait sortir les éléments les plus récents en premier.

## Langues

- Staff et director : 日本語 (par défaut), EN, FR. Le japonais est choisi sauf si le navigateur est en français ou en anglais.
- Client : FR, EN, JA, 中文, 한국어, ES, DE.

## Phases

1. **Fondations** ✅ : inscription director, connexion, hôtels, chambres (création en série « 101-120 »), comptes staff, QR imprimables, page `/r/:code` qui change selon le rôle.
2. **Vue staff** ✅ (version de base) : à faire / en cours / fait, dernière fois, commentaires par type, historique, arrivée et départ du client.
3. **Client** : demandes ✅ (version de base). Restent le chat temps réel (Web PubSub) et la traduction (Translator).
4. **Éditeur de plan** : grille vue de haut, pinceaux (moquette, carrelage, mur, porte), chambres posées sur la grille, plusieurs étages. Le plan devient le tableau de bord, chaque chambre colorée selon son état.
5. **Mode chronométré** : scan au début, scan à la fin, puis « facile / normal / difficile ». Temps moyen par chambre et par employé.
6. **App iPhone** : plus tard, avec la même API.
