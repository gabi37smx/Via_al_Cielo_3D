/*
 * La sala de la carrera sobre Supabase Realtime. Sin servidor propio y sin
 * tablas: solo un CANAL por sala (`sala:ABCD`) con dos herramientas:
 *
 * - Presencia (presence): quién está, con su nombre, cuándo entró y su
 *   semilla. Supabase avisa cuando alguien entra o se va (también si se le
 *   cierra el navegador). De aquí salen el anfitrión y la semilla.
 * - Difusión (broadcast): cada jugador envía su estado ~10 veces por
 *   segundo. No se guarda en ningún sitio y no vuelve al que lo envía.
 *
 * La clave es la «publishable» (pública): puede ir en el navegador. La
 * secreta no se usa nunca en el juego.
 */
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import {
  MAX_JUGADORES,
  cabeEnSala,
  codificar,
  decodificar,
  elegirAnfitrion,
  ordenarMiembros,
  type EstadoRed,
  type Miembro,
} from './protocolo.ts';

export interface ConfigRed {
  url: string;
  clave: string;
}

/** Datos de Supabase del archivo .env (o de variables de entorno VITE_…). */
export function configuracionRed(): ConfigRed | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const clave = import.meta.env.VITE_SUPABASE_CLAVE as string | undefined;
  return url && clave ? { url: url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, ''), clave } : null;
}

export interface Sala {
  codigo: string;
  yo: Miembro;
  /** Semilla de la torre: la del anfitrión. */
  semilla: number;
  miembros(): Miembro[];
  anfitrion(): Miembro | undefined;
  enviarEstado(e: EstadoRed): void;
  alRecibirEstado(cb: (id: string, e: EstadoRed) => void): void;
  alCambiarMiembros(cb: (miembros: Miembro[]) => void): void;
  salir(): Promise<void>;
}

export class ErrorSala extends Error {}

const ESPERA_CONEXION = 12_000;
/**
 * Tras verse a sí mismo en la sala, cuánto se espera a que llegue quién
 * estaba ya (ms). Supabase puede avisar de la propia entrada ANTES de mandar
 * la lista de los que había: sin esta espera, el que entra se creía solo,
 * se quedaba con su semilla y construía otra torre (fallo visto en
 * `npm run prueba-red`, 1 de cada 2-3 veces).
 */
const ESPERA_LISTA = 1_000;

function idAleatorio(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Convierte lo que guarda Supabase en la presencia en nuestra lista de miembros. */
function leerPresencia(canal: RealtimeChannel): Miembro[] {
  const estado = canal.presenceState<{ nombre: string; unidoEn: number; semilla: number }>();
  const miembros: Miembro[] = [];
  for (const [id, metas] of Object.entries(estado)) {
    const m = metas[0];
    if (m && typeof m.nombre === 'string' && Number.isFinite(m.unidoEn) && Number.isFinite(m.semilla)) {
      miembros.push({ id, nombre: m.nombre, unidoEn: m.unidoEn, semilla: m.semilla });
    }
  }
  return ordenarMiembros(miembros);
}

export async function unirseASala(config: ConfigRed, codigo: string, nombre: string, semillaPropia: number): Promise<Sala> {
  const cliente = createClient(config.url, config.clave, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 30 } },
  });
  const yo: Miembro = { id: idAleatorio(), nombre, unidoEn: Date.now(), semilla: semillaPropia };
  const canal = cliente.channel(`sala:${codigo}`, {
    config: { broadcast: { self: false, ack: false }, presence: { key: yo.id } },
  });

  let miembros: Miembro[] = [];
  const oyentesMiembros: ((m: Miembro[]) => void)[] = [];
  const oyentesEstado: ((id: string, e: EstadoRed) => void)[] = [];

  canal.on('broadcast', { event: 'estado' }, ({ payload }) => {
    const id = typeof payload?.id === 'string' ? payload.id : null;
    const e = decodificar(payload?.d);
    if (id && e && id !== yo.id && miembros.some((m) => m.id === id)) for (const cb of oyentesEstado) cb(id, e);
  });

  // Esperar a estar dentro, a ver nuestra propia presencia y un poco más
  // (ESPERA_LISTA) para que llegue la lista de los que ya estaban: entonces
  // se sabe quién es el anfitrión y cuál es la semilla.
  const listo = new Promise<void>((resolver, rechazar) => {
    const plazo = setTimeout(() => rechazar(new ErrorSala('No se pudo conectar con la sala (¿hay internet?)')), ESPERA_CONEXION);
    let dentro = false;
    canal.on('presence', { event: 'sync' }, () => {
      miembros = leerPresencia(canal);
      for (const cb of oyentesMiembros) cb(miembros);
      if (!dentro && miembros.some((m) => m.id === yo.id)) {
        dentro = true;
        clearTimeout(plazo);
        setTimeout(resolver, ESPERA_LISTA);
      }
    });
    canal.subscribe((estado) => {
      if (estado === 'SUBSCRIBED') {
        void canal.track({ nombre: yo.nombre, unidoEn: yo.unidoEn, semilla: yo.semilla });
      } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
        clearTimeout(plazo);
        rechazar(new ErrorSala('Supabase ha rechazado la conexión con la sala'));
      }
    });
  });

  try {
    await listo;
  } catch (e) {
    await cliente.removeChannel(canal);
    throw e;
  }

  if (!cabeEnSala(miembros, yo.id)) {
    await cliente.removeChannel(canal);
    throw new ErrorSala(`La sala ${codigo} está llena (máximo ${MAX_JUGADORES})`);
  }

  // La torre es la del anfitrión. Se adopta su semilla y se publica, para que
  // si el anfitrión se va, el siguiente ya tenga la misma.
  const semilla = elegirAnfitrion(miembros)?.semilla ?? semillaPropia;
  if (semilla !== yo.semilla) {
    yo.semilla = semilla;
    void canal.track({ nombre: yo.nombre, unidoEn: yo.unidoEn, semilla });
  }

  return {
    codigo,
    yo,
    semilla,
    miembros: () => miembros,
    anfitrion: () => elegirAnfitrion(miembros),
    enviarEstado(e) {
      void canal.send({ type: 'broadcast', event: 'estado', payload: { id: yo.id, d: codificar(e) } });
    },
    alRecibirEstado: (cb) => void oyentesEstado.push(cb),
    alCambiarMiembros: (cb) => void oyentesMiembros.push(cb),
    async salir() {
      await canal.untrack();
      await cliente.removeChannel(canal);
    },
  };
}
