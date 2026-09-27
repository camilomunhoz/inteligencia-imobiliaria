export interface GeocodeResult {
  lat: number;
  lng: number;
  provider: 'nominatim' | 'google' | 'bairro_fallback' | 'poa_default';
  formattedAddress?: string;
}

// Centroides conhecidos dos principais bairros de Porto Alegre para fallback robusto
const BAIRROS_POA_COORDS: Record<string, { lat: number; lng: number }> = {
  'bom fim': { lat: -30.0335, lng: -51.2120 },
  'moinhos de vento': { lat: -30.0261, lng: -51.2005 },
  'petropolis': { lat: -30.0410, lng: -51.1870 },
  'menino deus': { lat: -30.0520, lng: -51.2220 },
  'rio branco': { lat: -30.0350, lng: -51.2010 },
  'bela vista': { lat: -30.0340, lng: -51.1920 },
  'mont serrat': { lat: -30.0290, lng: -51.1920 },
  'centro historico': { lat: -30.0310, lng: -51.2280 },
  'centro': { lat: -30.0310, lng: -51.2280 },
  'cidade baixa': { lat: -30.0400, lng: -51.2220 },
  'santana': { lat: -30.0470, lng: -51.2090 },
  'passo dareia': { lat: -30.0150, lng: -51.1730 },
  'floresta': { lat: -30.0220, lng: -51.2100 },
  'auxiliadora': { lat: -30.0220, lng: -51.1930 },
  'higienopolis': { lat: -30.0180, lng: -51.1840 },
  'jardim botanico': { lat: -30.0530, lng: -51.1780 },
  'cristo redentor': { lat: -30.0110, lng: -51.1570 },
  'praia de belas': { lat: -30.0550, lng: -51.2310 },
  'tristeza': { lat: -30.1120, lng: -51.2580 },
};

async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'InteligenciaImobiliaria/1.0 (analise-imoveis-poa)',
        'Accept-Language': 'pt-BR',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        provider: 'nominatim',
        formattedAddress: data[0].display_name,
      };
    }
  } catch (err: unknown) {
    console.warn('[Geocoder] Falha no Nominatim:', (err as Error).message);
  }

  return null;
}

async function geocodeGoogle(query: string): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const encoded = encodeURIComponent(query);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
      }>;
    };

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return {
        lat: loc.lat,
        lng: loc.lng,
        provider: 'google',
        formattedAddress: data.results[0].formatted_address,
      };
    }
  } catch (err: unknown) {
    console.warn('[Geocoder] Falha no Google Maps:', (err as Error).message);
  }

  return null;
}

export async function geocodeAddress(
  address: string,
  bairro?: string
): Promise<GeocodeResult> {
  const primaryProvider = process.env.GEOCODER_PRIMARY || 'nominatim';

  // Sanitizar consulta garantindo contexto de Porto Alegre
  let searchQuery = address;
  if (!searchQuery.toLowerCase().includes('porto alegre')) {
    searchQuery += ', Porto Alegre - RS, Brasil';
  }

  console.log(`[Geocoder] Geocodificando: "${searchQuery}" (Primário: ${primaryProvider})...`);

  // 1. Tentar provedor primário
  let result: GeocodeResult | null = null;
  if (primaryProvider === 'nominatim') {
    result = await geocodeNominatim(searchQuery);
    if (!result) {
      console.log('[Geocoder] Nominatim não retornou resultado. Tentando Google Maps...');
      result = await geocodeGoogle(searchQuery);
    }
  } else {
    result = await geocodeGoogle(searchQuery);
    if (!result) {
      console.log('[Geocoder] Google Maps não retornou resultado. Tentando Nominatim...');
      result = await geocodeNominatim(searchQuery);
    }
  }

  if (result) {
    console.log(`[Geocoder] Coordenadas encontradas via ${result.provider}: (${result.lat}, ${result.lng})`);
    return result;
  }

  // 2. Fallback de Bairro
  if (bairro) {
    const normalizedBairro = bairro.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    for (const [key, coords] of Object.entries(BAIRROS_POA_COORDS)) {
      if (normalizedBairro.includes(key) || key.includes(normalizedBairro)) {
        console.log(`[Geocoder] Usando centroide aproximado do bairro "${bairro}": (${coords.lat}, ${coords.lng})`);
        return {
          lat: coords.lat,
          lng: coords.lng,
          provider: 'bairro_fallback',
        };
      }
    }
  }

  // 3. Fallback central de Porto Alegre (Praça da Matriz / Centro)
  console.warn('[Geocoder] Todos os geocoders falharam. Usando coordenadas centrais de Porto Alegre.');
  return {
    lat: -30.0346,
    lng: -51.2177,
    provider: 'poa_default',
  };
}
