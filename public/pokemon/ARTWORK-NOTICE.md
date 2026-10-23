# Pokémon artwork

The five locally cached WebP files are optimized copies of official artwork distributed by the PokeAPI sprites repository: https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/other/official-artwork . Exact sources and local SHA-256 hashes are in manifest.json.

Pokémon names, characters and artwork belong to their respective owners, including Nintendo, Creatures, GAME FREAK and The Pokémon Company. PokeAPI hosting or a software repository license must not be interpreted as granting rights to this artwork. No ownership, endorsement, commercial license or redistribution permission is claimed. Review the applicable rights before publishing, distributing or commercially using these assets. This integration is for the user's private home learning installation.

Run `npm run assets:pokemon` to fetch missing or invalid files, optimize them with Sharp, and refresh the manifest. The build runs this automatically; valid cached files require no network. Gameplay loads only local `/pokemon/*.webp` files and never contacts an artwork service. Static artwork is animated in CSS; external animated sprites are deliberately unnecessary.
