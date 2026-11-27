import { app } from '@azure/functions';

export class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

// Enregistre une route HTTP avec gestion d'erreurs commune.
export function route(name, methods, path, handler) {
  app.http(name, {
    methods,
    route: path,
    authLevel: 'anonymous',
    handler: async (request, context) => {
      try {
        const body = ['POST', 'PATCH', 'PUT'].includes(request.method)
          ? await request.json().catch(() => ({}))
          : {};
        const result = await handler({ request, context, body, params: request.params });
        return { status: 200, jsonBody: result ?? { ok: true } };
      } catch (e) {
        if (e instanceof HttpError) return { status: e.status, jsonBody: { error: e.code } };
        context.error(e);
        return { status: 500, jsonBody: { error: 'server_error' } };
      }
    },
  });
}

export function need(value, code = 'bad_request') {
  if (value === undefined || value === null || value === '') throw new HttpError(400, code);
  return value;
}

export function str(v, max = 500) {
  return String(v ?? '').trim().slice(0, max);
}
