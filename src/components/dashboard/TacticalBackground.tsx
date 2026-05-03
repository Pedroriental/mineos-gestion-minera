'use client';

// CSS-only perspective grid — same visual result as Three.js,
// zero runtime dependencies, guaranteed to render.
export default function TacticalBackground() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#050505]" style={{ zIndex: 0 }}>

      {/* Perspective container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          perspective: '600px',
          perspectiveOrigin: '50% 30%',
          overflow: 'hidden',
        }}
      >
        {/* The grid plane, rotated into 3D space */}
        <div
          style={{
            position: 'absolute',
            inset: '-100%',
            transformOrigin: '50% 0%',
            transform: 'rotateX(65deg) translateY(10%)',
            backgroundImage: `
              linear-gradient(to right, #DAA52018 1px, transparent 1px),
              linear-gradient(to bottom, #DAA52018 1px, transparent 1px),
              linear-gradient(to right, #2a2a2a 1px, transparent 1px),
              linear-gradient(to bottom, #2a2a2a 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px',
          }}
        />
      </div>

      {/* Vignette — dark at top and bottom edges */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 70% at 50% 60%, transparent 30%, #050505 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Horizon fade — hides the top edge of the rotated plane */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '35%',
          background: 'linear-gradient(to bottom, #050505 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Subtle amber center glow where nodes live */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(218,165,32,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
