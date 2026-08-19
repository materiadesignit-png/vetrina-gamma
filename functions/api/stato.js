// Stato della vetrina: cosa deve andare in onda.
//
// GET  /api/stato  -> lo legge chiunque (lo legge la TV)
// POST /api/stato  -> lo scrive solo chi conosce la parola d'ordine
//
// Lo stato sta in KV, quindi cambia all'istante: non serve ridistribuire
// il sito come succedeva con stato.json dentro il repository.

const PREDEFINITO = {
  mostra: 'foto',
  messaggio: '',
  giro: [],
  aggiornato: '',
};

// Confronto a tempo costante: un confronto normale con === esce al primo
// carattere diverso, e dai tempi di risposta si potrebbe indovinare la
// parola un pezzo alla volta.
function stessaParola(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const A = new TextEncoder().encode(a);
  const B = new TextEncoder().encode(b);
  let diverso = A.length ^ B.length;
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) diverso |= (A[i] || 0) ^ (B[i] || 0);
  return diverso === 0;
}

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
  const grezzo = await env.VETRINA.get('stato');
  return risposta(grezzo ? JSON.parse(grezzo) : PREDEFINITO);
}

export async function onRequestPost({ request, env }) {
  const parola = request.headers.get('x-parola') || '';
  if (!env.PAROLA || !stessaParola(parola, env.PAROLA)) {
    // piccolo ritardo: rende poco pratico provare parole a raffica
    await new Promise((r) => setTimeout(r, 900));
    return risposta({ errore: 'parola d\u2019ordine errata' }, 401);
  }

  let corpo;
  try { corpo = await request.json(); }
  catch { return risposta({ errore: 'dati non validi' }, 400); }

  // si accetta solo quello che serve: niente campi arbitrari in archivio
  const ammessi = ['foto', 'spot', 'vetrina', 'giro'];
  const nuovo = {
    mostra: ammessi.includes(corpo.mostra) ? corpo.mostra : 'foto',
    messaggio: String(corpo.messaggio || '').slice(0, 300),
    giro: Array.isArray(corpo.giro) ? corpo.giro.slice(0, 12).map(pulisci).filter(Boolean) : [],
    aggiornato: new Date().toISOString(),
  };

  await env.VETRINA.put('stato', JSON.stringify(nuovo));
  return risposta(nuovo);
}

// una tappa del giro: o un filmato, o un indirizzo web
function pulisci(v) {
  if (!v || typeof v !== 'object') return null;
  const durata = Math.min(600, Math.max(5, Number(v.durata) || 40));
  if (v.tipo === 'film') {
    return ['foto', 'spot', 'vetrina'].includes(v.nome)
      ? { tipo: 'film', nome: v.nome, durata } : null;
  }
  if (v.tipo === 'web') {
    let url;
    try { url = new URL(String(v.url)); } catch { return null; }
    if (url.protocol !== 'https:') return null;   // niente http: la pagina e' in https
    return {
      tipo: 'web',
      url: url.href,
      durata,
      altezza: Math.max(0, Math.min(20000, Number(v.altezza) || 0)),
    };
  }
  return null;
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-parola',
    },
  });
}
