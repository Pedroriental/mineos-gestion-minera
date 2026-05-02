'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// Slow rotation of the camera for a subtle "scanning" effect
function CameraRig() {
  const ref = useRef<THREE.PerspectiveCamera>(null!);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.position.x = Math.sin(t * 0.04) * 3;
  });
  return (
    <PerspectiveCamera
      ref={ref}
      makeDefault
      position={[0, 55, 48]}
      fov={38}
    />
  );
}

export default function TacticalBackground() {
  return (
    <Canvas
      className="absolute inset-0"
      style={{ background: '#050505' }}
      gl={{ antialias: false, alpha: false }}
      dpr={[1, 1.5]}
    >
      <CameraRig />
      <ambientLight intensity={0} />

      {/* Primary grid — large cells */}
      <Grid
        args={[300, 300]}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
        cellSize={4}
        cellThickness={0.4}
        cellColor="#222222"
        sectionSize={20}
        sectionThickness={0.8}
        sectionColor="#2a2a2a"
        fadeDistance={180}
        fadeStrength={2}
        infiniteGrid
      />
    </Canvas>
  );
}
