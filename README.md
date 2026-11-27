# Hotel Ops

Web app de gestion d'hôtel pensée pour le Japon (hôtels, ryokan). Un **seul QR code par chambre** :

- le **client** le scanne sans compte, tape son code séjour, puis fait des demandes (serviettes, ménage, problème, message) dans sa langue ;
- le **staff**, connecté, scanne le même QR et arrive sur la gestion de la chambre : à faire / fait, dernier ménage, commentaires, consommations, historique, arrivée et départ du client ;
- le **director** crée l'hôtel, les chambres, les comptes staff, imprime les QR et active le **mode chronométré** (scan au début et à la fin du ménage, puis difficulté).

Langues : staff et director en FR/EN ; client en 日本語, English, 中文, 한국어, Français, Español, Deutsch.

Architecture et plan des phases : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

- Front : JavaScript simple + Vite (`app/`)
- API : Azure Functions v4, Node, JavaScript (`api/`)
- Données : Azure Table Storage (Azurite en local)
- Hébergement : Azure Static Web Apps

## Lancer en local

Il faut Node 20 ou plus récent et [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local).

```bash
npm run setup   # installe tout et crée api/local.settings.json
npm run dev     # Azurite + API (7071) + site (5180)
```

Ensuite, ouvrir http://localhost:5180, créer un compte director, puis un hôtel et des chambres.

Pour tester sur un téléphone, il doit être sur le même Wi-Fi. Ouvrir l'adresse « Network » affichée par Vite. Les QR imprimés pointent vers l'adresse utilisée au moment de l'impression.
