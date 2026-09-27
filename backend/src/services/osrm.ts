/**
 * Serviço de Roteamento OSRM (Pé e Carro) com Fallback Geodésico Resiliente.
 * Permite calcular rotas reais por malha viária urbana em Porto Alegre
 * com garantia de funcionamento ininterrupto caso o serviço OSRM esteja offline.
 */

export type PerfilRoteamento = 'pe' | 'carro';

export interface RouteResult {
  success: boolean;
  perfil: PerfilRoteamento;
  fonte: 'osrm' | 'fallback_geodesico';
  distancia_metros: number;
  duracao_segundos: number;
  distancia_formatada: string;
  duracao_formatada: string;
  geometria: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

// Configurações de endpoints OSRM
const OSRM_FOOT_URL = process.env.OSRM_FOOT_URL || 'http://localhost:5001';
const OSRM_CAR_URL = process.env.OSRM_CAR_URL || 'http://localhost:5000';

/**
 * Fórmula de Haversine para cálculo de distância geodésica em linha reta (metros).
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Raio médio da Terra em metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '< 1 min';
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}min`;
  }
  return `${mins} min`;
}

/**
 * Fallback resiliente geodésico quando o OSRM não estiver acessível.
 * Aplica fator de correção urbano (detour factor) para simular percurso em malha viária.
 */
function createFallbackRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  perfil: PerfilRoteamento
): RouteResult {
  const straightMeters = haversineDistance(fromLat, fromLng, toLat, toLng);

  // Fatores de correção da malha urbana de Porto Alegre
  const detourFactor = perfil === 'pe' ? 1.25 : 1.35;
  const estimatedMeters = Math.round(straightMeters * detourFactor);

  // Velocidades médias: 4.8 km/h para caminhada (~1.33 m/s) e 30 km/h para carro (~8.33 m/s)
  const speedMetersPerSec = perfil === 'pe' ? 1.33 : 8.33;
  const estimatedSeconds = Math.round(estimatedMeters / speedMetersPerSec);

  return {
    success: true,
    perfil,
    fonte: 'fallback_geodesico',
    distancia_metros: estimatedMeters,
    duracao_segundos: estimatedSeconds,
    distancia_formatada: formatDistance(estimatedMeters),
    duracao_formatada: formatDuration(estimatedSeconds),
    geometria: {
      type: 'LineString',
      coordinates: [
        [fromLng, fromLat],
        [toLng, toLat],
      ],
    },
  };
}

/**
 * Tenta obter a rota real por ruas via OSRM com fallback geodésico automático.
 */
export async function getRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  perfil: PerfilRoteamento = 'pe'
): Promise<RouteResult> {
  const baseUrl = perfil === 'pe' ? OSRM_FOOT_URL : OSRM_CAR_URL;
  const osrmProfile = perfil === 'pe' ? 'foot' : 'driving';
  const url = `${baseUrl}/route/v1/${osrmProfile}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const dist = Math.round(route.distance);
        const dur = Math.round(route.duration);

        return {
          success: true,
          perfil,
          fonte: 'osrm',
          distancia_metros: dist,
          duracao_segundos: dur,
          distancia_formatada: formatDistance(dist),
          duracao_formatada: formatDuration(dur),
          geometria: route.geometry,
        };
      }
    }
  } catch {
    // Falha de conexão ou timeout no OSRM local: aciona fallback silenciosamente
  }

  // Fallback garantido
  return createFallbackRoute(fromLng, fromLat, toLng, toLat, perfil);
}
