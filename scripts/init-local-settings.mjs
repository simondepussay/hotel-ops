// Crée api/local.settings.json (ignoré par git) avec un secret aléatoire.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const target = new URL('../api/local.settings.json', import.meta.url);
if (existsSync(target)) {
  console.log('api/local.settings.json existe déjà');
} else {
  const example = JSON.parse(readFileSync(new URL('../api/local.settings.example.json', import.meta.url)));
  example.Values.AUTH_SECRET = randomBytes(32).toString('hex');
  writeFileSync(target, JSON.stringify(example, null, 2) + '\n');
  console.log('api/local.settings.json créé');
}
