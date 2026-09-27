import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { type Imovel } from '../types/imovel.js';
import {
  Layers,
  Car,
  Footprints,
  X,
  Navigation,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MapProps {
  imoveis: Imovel[];
  selectedImovel: Imovel | null;
  hoveredImovel: Imovel | null;
  onSelectImovel: (imovel: Imovel) => void;
  isDarkMode?: boolean;
}

interface POIProperties {
  id: number;
  nome: string;
  categoria: string;
  endereco?: string;
}

interface ActiveRoute {
  poiName: string;
  poiCategoria: string;
  distanciaFormatada: string;
  duracaoFormatada: string;
  fonte: 'osrm' | 'fallback_geodesico';
  perfil: 'pe' | 'carro';
  poiCoords: [number, number];
}

const POI_CATEGORIES = [
  { id: 'parque', label: 'Parques', color: '#10b981' },
  { id: 'praca', label: 'Praças', color: '#34d399' },
  { id: 'supermercado', label: 'Supermercados', color: '#3b82f6' },
  { id: 'farmacia', label: 'Farmácias', color: '#06b6d4' },
  { id: 'padaria', label: 'Padarias', color: '#f59e0b' },
  { id: 'referencia', label: 'Pontos Notáveis', color: '#8b5cf6' },
];

export const Map: React.FC<MapProps> = ({
  imoveis,
  selectedImovel,
  hoveredImovel,
  onSelectImovel,
  isDarkMode,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [id: number]: maplibregl.Marker }>({});

  // Camadas de POIs visíveis
  const [activeCategories, setActiveCategories] = useState<string[]>([
    'parque',
    'praca',
    'supermercado',
    'farmacia',
    'padaria',
    'referencia',
  ]);
  const [showLayerPanel, setShowLayerPanel] = useState<boolean>(false);

  // Rota ativa
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const [routeProfile, setRouteProfile] = useState<'pe' | 'carro'>('pe');
  const [isRouting, setIsRouting] = useState<boolean>(false);

  // POI selecionado para popup/ação
  const [selectedPoi, setSelectedPoi] = useState<{
    props: POIProperties;
    coords: [number, number];
  } | null>(null);

  const mapStyle = isDarkMode
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  // 1. Inicializar o mapa MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;

    const instance = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [-51.2120, -30.0335], // Centro em Porto Alegre
      zoom: 13,
      attributionControl: false,
    });

    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    instance.on('load', async () => {
      // 1.1 Carregar camada GeoJSON de POIs (alta performance via WebGL)
      try {
        const res = await fetch('/api/pois');
        if (res.ok) {
          const poisData = await res.json();

          if (!instance.getSource('pois-source')) {
            instance.addSource('pois-source', {
              type: 'geojson',
              data: poisData,
            });

            // Camada de círculos com cores por categoria
            instance.addLayer({
              id: 'pois-circles',
              type: 'circle',
              source: 'pois-source',
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  11, 4,
                  14, 6.5,
                  16, 9,
                ],
                'circle-color': [
                  'match',
                  ['get', 'categoria'],
                  'parque', '#10b981',
                  'praca', '#34d399',
                  'supermercado', '#3b82f6',
                  'farmacia', '#06b6d4',
                  'padaria', '#f59e0b',
                  'referencia', '#8b5cf6',
                  '#64748b',
                ],
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.85,
              },
            });

            // Hover e clique no POI
            instance.on('mouseenter', 'pois-circles', () => {
              instance.getCanvas().style.cursor = 'pointer';
            });
            instance.on('mouseleave', 'pois-circles', () => {
              instance.getCanvas().style.cursor = '';
            });

            instance.on('click', 'pois-circles', (e) => {
              if (!e.features || e.features.length === 0) return;
              const feat = e.features[0];
              const coords = (feat.geometry as any).coordinates as [number, number];
              const props = feat.properties as unknown as POIProperties;

              setSelectedPoi({ props, coords });
            });
          }
        }
      } catch (err) {
        console.error('Erro ao carregar POIs:', err);
      }

      // 1.2 Fonte e camadas para traçado de rotas
      if (!instance.getSource('route-source')) {
        instance.addSource('route-source', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

        // Contorno da linha da rota
        instance.addLayer({
          id: 'route-line-casing',
          type: 'line',
          source: 'route-source',
          paint: {
            'line-color': '#0f172a',
            'line-width': 6,
            'line-opacity': 0.35,
          },
        });

        // Linha principal da rota
        instance.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-source',
          paint: {
            'line-color': '#2563eb',
            'line-width': 3.5,
            'line-opacity': 0.95,
          },
        });
      }
    });

    map.current = instance;

    return () => {
      instance.remove();
    };
  }, [mapStyle]);

  // 2. Atualizar filtro de categorias de POIs
  useEffect(() => {
    if (!map.current || !map.current.getLayer('pois-circles')) return;

    if (activeCategories.length === 0) {
      map.current.setLayoutProperty('pois-circles', 'visibility', 'none');
    } else {
      map.current.setLayoutProperty('pois-circles', 'visibility', 'visible');
      map.current.setFilter('pois-circles', [
        'in',
        ['get', 'categoria'],
        ['literal', activeCategories],
      ]);
    }
  }, [activeCategories]);

  // 3. Atualizar marcadores HTML de Imóveis
  useEffect(() => {
    if (!map.current) return;

    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    imoveis.forEach((item) => {
      if (!item.latitude || !item.longitude) return;

      const isSelected = selectedImovel?.id === item.id;
      const isHovered = hoveredImovel?.id === item.id;
      const isVenda = item.tipo_transacao === 'venda';

      const el = document.createElement('div');
      el.className = 'cursor-pointer transition-transform duration-200';

      const badgeColor =
        item.scoreFinal >= 8.0
          ? 'bg-emerald-600 text-white'
          : item.scoreFinal >= 6.0
          ? 'bg-blue-600 text-white'
          : item.scoreFinal >= 4.0
          ? 'bg-amber-600 text-white'
          : 'bg-rose-600 text-white';

      el.innerHTML = `
        <div class="flex items-center gap-1 rounded-full border border-white/80 px-2.5 py-1 text-xs font-bold shadow-md transition-all ${
          isSelected || isHovered
            ? 'scale-110 ring-4 ring-primary/40 ' + badgeColor
            : badgeColor
        }">
          <span class="text-[10px] opacity-90">${isVenda ? 'V' : 'A'}</span>
          <span>${item.scoreFinal.toFixed(1)}</span>
        </div>
      `;

      el.addEventListener('click', () => {
        onSelectImovel(item);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.longitude, item.latitude])
        .addTo(map.current!);

      markersRef.current[item.id] = marker;
    });

    if (imoveis.length > 0 && !selectedImovel && !activeRoute) {
      const bounds = new maplibregl.LngLatBounds();
      imoveis.forEach((item) => {
        if (item.longitude && item.latitude) {
          bounds.extend([item.longitude, item.latitude]);
        }
      });
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1000 });
    }
  }, [imoveis, selectedImovel?.id, hoveredImovel?.id, onSelectImovel, activeRoute]);

  // 4. Centralizar no imóvel selecionado
  useEffect(() => {
    if (!map.current || !selectedImovel || activeRoute) return;
    map.current.flyTo({
      center: [selectedImovel.longitude, selectedImovel.latitude],
      zoom: 15,
      essential: true,
      duration: 1000,
    });
  }, [selectedImovel, activeRoute]);

  // 5. Função de cálculo e traçado da rota sob demanda
  const traceRoute = useCallback(
    async (
      fromCoords: [number, number],
      toCoords: [number, number],
      poiProps: POIProperties,
      profile: 'pe' | 'carro'
    ) => {
      if (!map.current) return;
      setIsRouting(true);

      try {
        const res = await fetch(
          `/api/rotas?origemLng=${fromCoords[0]}&origemLat=${fromCoords[1]}&destinoLng=${toCoords[0]}&destinoLat=${toCoords[1]}&perfil=${profile}`
        );

        if (!res.ok) throw new Error('Falha ao calcular rota');
        const data = await res.json();

        // Atualizar fonte GeoJSON da rota no MapLibre
        const routeSource = map.current.getSource('route-source') as maplibregl.GeoJSONSource;
        if (routeSource) {
          routeSource.setData({
            type: 'Feature',
            geometry: data.geometria,
            properties: {},
          });
        }

        setActiveRoute({
          poiName: poiProps.nome,
          poiCategoria: poiProps.categoria,
          distanciaFormatada: data.distancia_formatada,
          duracaoFormatada: data.duracao_formatada,
          fonte: data.fonte,
          perfil: profile,
          poiCoords: toCoords,
        });

        // Enquadrar o mapa entre os dois pontos da rota
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend(fromCoords);
        bounds.extend(toCoords);
        map.current.fitBounds(bounds, { padding: 90, maxZoom: 16, duration: 800 });
      } catch (err) {
        console.error('Erro ao traçar rota:', err);
      } finally {
        setIsRouting(false);
      }
    },
    []
  );

  // Limpar traçado da rota
  const clearRoute = () => {
    setActiveRoute(null);
    setSelectedPoi(null);
    if (!map.current) return;

    const routeSource = map.current.getSource('route-source') as maplibregl.GeoJSONSource;
    if (routeSource) {
      routeSource.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  };

  // Alternar modalidade da rota ativa (A pé <-> De carro)
  const toggleRouteProfile = (newProfile: 'pe' | 'carro') => {
    setRouteProfile(newProfile);
    if (activeRoute && selectedImovel) {
      traceRoute(
        [selectedImovel.longitude, selectedImovel.latitude],
        activeRoute.poiCoords,
        {
          id: 0,
          nome: activeRoute.poiName,
          categoria: activeRoute.poiCategoria,
        },
        newProfile
      );
    }
  };

  const toggleCategory = (catId: string) => {
    setActiveCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-muted shadow-sm">
      <div ref={mapContainer} className="h-full w-full" />

      {/* Painel Flutuante de Camadas GeoJSON de POIs (8.2) */}
      <div className="absolute top-3 left-3 z-10">
        <div className="rounded-xl border bg-card/90 backdrop-blur-md shadow-md">
          <button
            type="button"
            onClick={() => setShowLayerPanel(!showLayerPanel)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/50 rounded-xl transition"
          >
            <Layers className="h-4 w-4 text-primary" />
            <span>Camadas ({activeCategories.length}/{POI_CATEGORIES.length})</span>
            {showLayerPanel ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {showLayerPanel && (
            <div className="border-t p-3 space-y-2 min-w-[190px]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
                Pontos de Interesse (OSM)
              </span>

              {POI_CATEGORIES.map((cat) => {
                const isChecked = activeCategories.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    className="flex items-center gap-2 text-xs text-foreground cursor-pointer hover:opacity-80 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCategory(cat.id)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span>{cat.label}</span>
                  </label>
                );
              })}

              <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setActiveCategories(POI_CATEGORIES.map((c) => c.id))}
                  className="hover:text-foreground"
                >
                  Marcar todos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategories([])}
                  className="hover:text-foreground"
                >
                  Desmarcar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Flutuante de POI Selecionado (Preparando rota) */}
      {selectedPoi && !activeRoute && (
        <div className="absolute top-3 right-3 z-10 max-w-xs rounded-xl border bg-card/95 backdrop-blur-md p-3.5 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                {selectedPoi.props.categoria}
              </span>
              <h4 className="mt-1 text-xs font-bold leading-tight text-foreground">
                {selectedPoi.props.nome}
              </h4>
              {selectedPoi.props.endereco && (
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                  {selectedPoi.props.endereco}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedPoi(null)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t">
            {selectedImovel ? (
              <button
                type="button"
                disabled={isRouting}
                onClick={() =>
                  traceRoute(
                    [selectedImovel.longitude, selectedImovel.latitude],
                    selectedPoi.coords,
                    selectedPoi.props,
                    routeProfile
                  )
                }
                className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>
                  {isRouting ? 'Calculando Rota...' : `Traçar Rota de #${selectedImovel.id}`}
                </span>
              </button>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center">
                Selecione um imóvel na lista para traçar a rota até aqui.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Card Flutuante de Rota Ativa (8.3 - Traçado de Rota sob Demanda) */}
      {activeRoute && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-20 sm:max-w-sm rounded-xl border bg-card/95 backdrop-blur-md p-4 shadow-xl">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Rota Traçada</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.2 text-[9px] font-semibold text-primary uppercase">
                {activeRoute.fonte === 'osrm' ? 'OSRM Ruas' : 'Linha Reta'}
              </span>
            </div>

            <button
              type="button"
              onClick={clearRoute}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Fechar rota"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2.5">
            <p className="text-xs text-muted-foreground">Destino:</p>
            <p className="text-xs font-semibold text-foreground truncate">{activeRoute.poiName}</p>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary/50 p-2.5">
            <div>
              <span className="text-[10px] text-muted-foreground block">Distância</span>
              <span className="text-sm font-bold text-foreground">{activeRoute.distanciaFormatada}</span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-muted-foreground block">Tempo Estimado</span>
              <span className="text-sm font-extrabold text-primary">{activeRoute.duracaoFormatada}</span>
            </div>
          </div>

          {/* Alternador de Perfil (A pé vs De carro) */}
          <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t">
            <div className="flex items-center rounded-lg border bg-muted/60 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => toggleRouteProfile('pe')}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition ${
                  routeProfile === 'pe'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                <Footprints className="h-3.5 w-3.5" />
                <span>A pé</span>
              </button>

              <button
                type="button"
                onClick={() => toggleRouteProfile('carro')}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition ${
                  routeProfile === 'carro'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                <Car className="h-3.5 w-3.5" />
                <span>Carro</span>
              </button>
            </div>

            <button
              type="button"
              onClick={clearRoute}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Limpar Rota
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
