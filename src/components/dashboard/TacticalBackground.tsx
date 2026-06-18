'use client';

import React from 'react';

export default function TacticalBackground() {
  return (
    <div data-tactical-bg className="absolute inset-0 w-full h-full overflow-hidden bg-[#030304]" style={{ zIndex: 0 }}>
      {/* 1. Capa del Mapa Satelital de Bolívar (Generado táctico) */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: "url('/bolivar-tactical-map.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          mixBlendMode: 'lighten',
          opacity: 0.60,
          filter: 'contrast(1.25) brightness(0.65) grayscale(0.3)',
        }}
      />

      {/* 2. Rejilla Táctica Fina (Líneas de cuadrícula) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(245, 158, 11, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(245, 158, 11, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* 3. Círculos de Radar Táctico Concéntricos */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[85vw] h-[85vw] max-w-[850px] max-h-[850px] border border-amber-500/[0.04] rounded-full absolute animate-pulse-soft" />
        <div className="w-[55vw] h-[55vw] max-w-[550px] max-h-[550px] border border-amber-500/[0.06] border-dashed rounded-full absolute" />
        <div className="w-[30vw] h-[30vw] max-w-[300px] max-h-[300px] border border-amber-500/[0.04] rounded-full absolute" />
      </div>

      {/* 4. Barrido del haz de radar (Efecto conic-gradient rotativo) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'conic-gradient(from 0deg at 50% 50%, rgba(245, 158, 11, 0.04) 0deg, rgba(245, 158, 11, 0) 110deg, transparent 360deg)',
          animation: 'radar-sweep-anim 16s linear infinite',
          transformOrigin: 'center center',
        }}
      />

      {/* 5. Líneas de escaneo (Efecto CRT sutil) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.20) 50%)',
          backgroundSize: '100% 4px',
        }}
      />

      {/* 6. Viñeta (Oscurecimiento de bordes para legibilidad del HUD) */}
      <div
        data-tactical-vignette
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 20%, rgba(3, 3, 4, 0.85) 95%)',
        }}
      />

      {/* 7. Textos de Telemetría Táctica (HUD) en las esquinas */}
      <div className="absolute top-6 left-6 font-mono text-[8px] text-amber-500/40 tracking-[0.25em] pointer-events-none hidden md:block select-none space-y-1">
        <p>SYS.LOC: REGION GUAYANA (ESTADO BOLIVAR)</p>
        <p>LAT: 7.1845° N | LON: 63.1012° W</p>
        <p>TARGET: COMPLEJO LA FE // ACTIVO</p>
      </div>

      <div className="absolute top-6 right-6 font-mono text-[8px] text-amber-500/40 tracking-[0.25em] pointer-events-none text-right hidden md:block select-none space-y-1">
        <p>SENSOR: TELEMETRIA_RADAR_SAT_8</p>
        <p>HEADING: 142.5° SEC // AUTO_TRACK</p>
        <p>SYSTEM STATUS: NOMINAL // LINK_CONNECTED</p>
      </div>

      <div className="absolute bottom-24 left-6 font-mono text-[8px] text-amber-500/30 tracking-[0.25em] pointer-events-none hidden md:block select-none">
        <p>ALTITUDE: 15,240M // SAT-L2</p>
        <p>SCALE: 1 : 45,000</p>
      </div>

      <div className="absolute bottom-24 right-6 font-mono text-[8px] text-amber-500/30 tracking-[0.25em] pointer-events-none text-right hidden md:block select-none">
        <p>GRID: UTM-ZONE-19N</p>
        <p>FEED: REALTIME_LIVE_FEED</p>
      </div>

      {/* Inyección de estilos de animación */}
      <style>{`
        @keyframes radar-sweep-anim {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
