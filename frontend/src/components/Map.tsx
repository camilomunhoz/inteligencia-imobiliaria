import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { type Imovel } from '../types/imovel.js';

interface MapProps {
  imoveis: Imovel[];
  selectedImovel: Imovel | null;
  hoveredImovel: Imovel | null;
  onSelectImovel: (imovel: Imovel) => void;
  isDarkMode?: boolean;
}

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

  // Estilo do mapa neutro e limpo (Positron para light, Dark Matter para dark)
  const mapStyle = isDarkMode
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  // Inicializar o mapa
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [-51.2120, -30.0335], // Centro em Bom Fim / Redenção, Porto Alegre
      zoom: 13,
      attributionControl: false,
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.current.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    return () => {
      map.current?.remove();
    };
  }, [mapStyle]);

  // Atualizar marcadores quando a lista de imóveis mudar
  useEffect(() => {
    if (!map.current) return;

    // Remover marcadores anteriores
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    imoveis.forEach((item) => {
      if (!item.latitude || !item.longitude) return;

      const isSelected = selectedImovel?.id === item.id;
      const isHovered = hoveredImovel?.id === item.id;
      const isVenda = item.tipo_transacao === 'venda';

      // Elemento HTML customizado para o marcador
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

    // Ajustar visualização para os limites de todos os pontos se houver imóveis
    if (imoveis.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      imoveis.forEach((item) => {
        if (item.longitude && item.latitude) {
          bounds.extend([item.longitude, item.latitude]);
        }
      });
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1000 });
    }
  }, [imoveis, selectedImovel?.id, hoveredImovel?.id, onSelectImovel]);

  // Centralizar no imóvel selecionado
  useEffect(() => {
    if (!map.current || !selectedImovel) return;
    map.current.flyTo({
      center: [selectedImovel.longitude, selectedImovel.latitude],
      zoom: 15,
      essential: true,
      duration: 1200,
    });
  }, [selectedImovel]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border bg-muted">
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
};
