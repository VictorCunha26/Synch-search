import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';

// Escala fixa de 4 degraus: o tamanho do pino diz a nota sem precisar ler o número.
const radiusFor = (s) => (s >= 85 ? 11 : s >= 70 ? 8.5 : s >= 45 ? 6.5 : 4.5);
const COLOR = { quente: '#e5484d', morno: '#f5a524', frio: '#a3a3a3' };

function Fit({ points, center }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lon]), { padding: [40, 40], maxZoom: 15 });
    else if (center) map.setView([center.lat, center.lon], 13);
  }, [points.length, center?.lat, center?.lon]);
  return null;
}

function Focus({ lead }) {
  const map = useMap();
  useEffect(() => { if (lead?.lat) map.panTo([lead.lat, lead.lon], { animate: true }); }, [lead?.id]);
  return null;
}

export default function MapView({ leads, selectedId, onSelect, center }) {
  const pts = useMemo(() => leads.filter((l) => l.lat != null).sort((a, b) => a.score - b.score), [leads]);
  const selected = pts.find((l) => l.id === selectedId);
  const start = center || (pts[0] ? { lat: pts[0].lat, lon: pts[0].lon } : { lat: -15.78, lon: -47.93 });
  return (
    <div className="map-wrap">
      <MapContainer center={[start.lat, start.lon]} zoom={center ? 13 : 4} scrollWheelZoom preferCanvas>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Fit points={pts} center={center} />
        <Focus lead={selected} />
        {pts.map((l) => (
          <CircleMarker
            key={l.id}
            center={[l.lat, l.lon]}
            radius={radiusFor(l.score) + (l.id === selectedId ? 2 : 0)}
            pathOptions={{ color: l.id === selectedId ? '#0a0a0a' : '#ffffff', weight: l.id === selectedId ? 2.5 : 1.5, fillColor: COLOR[l.temperature], fillOpacity: 0.92 }}
            eventHandlers={{ click: () => onSelect(l.id) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <b>{l.score}</b> · {l.name}<br />{l.pain?.label}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-legend" aria-label="Legenda">
        <span><span className="tdot quente" />Quente</span>
        <span><span className="tdot morno" />Morno</span>
        <span><span className="tdot frio" />Frio</span>
        <span className="faint">Tamanho = nota</span>
      </div>
    </div>
  );
}
