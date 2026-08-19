// Battito della vetrina.
//
// La TV manda un segnale ogni minuto dicendo che e' viva e cosa sta
// riproducendo. Il pannello legge questo per dire "online" oppure
// "nessun contatto da 40 minuti".
//
// POST /api/battito  -> la TV segnala di essere viva
// GET  /api/battito  -> il pannello legge l'ultimo segnale

const risposta = (dati, codice = 200) =>
  new Response(JSON.stringify(dati), {
    status: codice,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });

export async function onRequestGet({ env }) {
  const grezzo = await env.VETRINA.get('battito');
  if (!grezzo) return risposta({ mai: true });
  const b = JSON.parse(grezzo);
  b.secondiFa = Math.round((Date.now() - new Date(b.visto).getTime()) / 1000);
  return risposta(b);
}

export async function onRequestPost({ request, env }) {
  let c = {};
  try { c = await request.json(); } catch { /* un battito malformato non merita un errore */ }

  const b = {
    visto: new Date().toISOString(),
    film: String(c.film || '').slice(0, 60),
    tempo: Math.round(Number(c.tempo) || 0),
    schermo: String(c.schermo || '').slice(0, 20),
    // utile per capire con che apparecchio sta girando (TV, Mac, telefono)
    agente: (request.headers.get('user-agent') || '').slice(0, 160),
    paese: request.headers.get('cf-ipcountry') || '',
  };

  // scade dopo un giorno: se la vetrina resta spenta, il pannello lo dice
  await env.VETRINA.put('battito', JSON.stringify(b), { expirationTtl: 86400 });
  return risposta({ ok: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}
