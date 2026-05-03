'use client';

import { Canvas } from '@react-three/fiber';
import { Grid, PerspectiveCamera } from '@react-three/drei';

export default function TacticalBackground() {
  return (
    <Canvas
      style={{ background: '#050505', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}
    >
      {/* Camera: picado isométrico mirando al centro */}
      <PerspectiveCamera
        makeDefault
        position={[0, 20, 30]}
        fov={45}
        onUpdate={(cam) => cam.lookAt(0, 0, 0)}
      />

      <ambientLight intensity={0.05} />

      {/* Cuadrícula táctica — líneas visibles */}
      <Grid
        args={[100, 100]}
        position={[0, 0, 0]}
        cellSize={1}
        cellThickness={1.2}
        cellColor="#303030"
        sectionSize={5}
        sectionThickness={2}
        sectionColor="#B8860B"
        fadeDistance={60}
        fadeStrength={1.5}
        infiniteGrid
      />
    </Canvas>
  );
}
