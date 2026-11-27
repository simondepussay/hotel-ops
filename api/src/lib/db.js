// Accès à Azure Table Storage (Azurite en local).
import { TableClient, odata } from '@azure/data-tables';

const conn = process.env.TABLES_CONNECTION || 'UseDevelopmentStorage=true';
const isLocal = conn.includes('UseDevelopmentStorage') || conn.includes('127.0.0.1');
const clients = new Map();

async function table(name) {
  if (!clients.has(name)) {
    const client = TableClient.fromConnectionString(conn, name, { allowInsecureConnection: isLocal });
    const ready = client.createTable().catch((e) => {
      if (e.statusCode !== 409) throw e;
    });
    clients.set(name, { client, ready });
  }
  const { client, ready } = clients.get(name);
  await ready;
  return client;
}

// Retire les métadonnées techniques renvoyées par Table Storage.
function clean(e) {
  if (!e) return e;
  const { etag, timestamp, 'odata.metadata': _m, ...rest } = e;
  return rest;
}

export async function get(t, pk, rk) {
  try {
    return clean(await (await table(t)).getEntity(pk, rk));
  } catch (e) {
    if (e.statusCode === 404) return null;
    throw e;
  }
}

export async function put(t, entity) {
  await (await table(t)).upsertEntity(entity, 'Replace');
  return entity;
}

export async function merge(t, entity) {
  await (await table(t)).upsertEntity(entity, 'Merge');
}

export async function insert(t, entity) {
  await (await table(t)).createEntity(entity); // 409 si existe déjà
  return entity;
}

export async function remove(t, pk, rk) {
  try {
    await (await table(t)).deleteEntity(pk, rk);
  } catch (e) {
    if (e.statusCode !== 404) throw e;
  }
}

export async function list(t, pk, { limit } = {}) {
  const client = await table(t);
  const out = [];
  for await (const e of client.listEntities({ queryOptions: { filter: odata`PartitionKey eq ${pk}` } })) {
    out.push(clean(e));
    if (limit && out.length >= limit) break;
  }
  return out;
}

// Clé qui trie du plus récent au plus ancien.
export function recentKey() {
  return String(9999999999999 - Date.now()).padStart(13, '0') + '_' + Math.random().toString(36).slice(2, 8);
}

// Clé qui trie du plus ancien au plus récent (fil de discussion).
export function timeKey() {
  return String(Date.now()).padStart(13, '0') + '_' + Math.random().toString(36).slice(2, 8);
}

export function newId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
