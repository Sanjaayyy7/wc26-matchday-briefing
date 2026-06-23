"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import palette from "@/data/aurora-palette.json";

// Signature visual (constitution: one cinematic moment per page). A field of
// points on pure black that undulates as a slow probability wave; crests warm
// to jade, troughs recede to ink. No globe, no glow pile — restrained depth.
// Hex literals live in data/aurora-palette.json (three.js needs literal colors).

const COLS = 58;
const ROWS = 32;
const SPACING = 0.34;
const AMP = 0.5;

function Field() {
  const ref = useRef<THREE.Points>(null);

  const { positions, colors, grid } = useMemo(() => {
    const count = COLS * ROWS;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const grid = new Float32Array(count * 2);
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = (c - COLS / 2) * SPACING;
        const z = (r - ROWS / 2) * SPACING;
        positions[i * 3] = x;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = z;
        grid[i * 2] = x;
        grid[i * 2 + 1] = z;
        i++;
      }
    }
    return { positions, colors, grid };
  }, []);

  const dim = useMemo(() => new THREE.Color(palette.pointDim), []);
  const crest = useMemo(() => new THREE.Color(palette.crest), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const pts = ref.current;
    if (!pts) return;
    const t = clock.elapsedTime;
    const pos = pts.geometry.attributes.position.array as Float32Array;
    const col = pts.geometry.attributes.color.array as Float32Array;
    const n = COLS * ROWS;
    for (let i = 0; i < n; i++) {
      const x = grid[i * 2];
      const z = grid[i * 2 + 1];
      const wave = Math.sin(x * 0.55 + t * 0.85) * Math.cos(z * 0.42 - t * 0.5);
      pos[i * 3 + 1] = wave * AMP;
      const m = (wave + 1) / 2; // 0..1 crest factor
      tmp.copy(dim).lerp(crest, m * m);
      col[i * 3] = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.geometry.attributes.color.needsUpdate = true;
    pts.rotation.y = Math.sin(t * 0.04) * 0.16;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.82}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function AuroraField() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 3.1, 7], fov: 36 }}
      style={{ background: "transparent" }}
    >
      <group rotation={[-0.34, 0, 0]}>
        <Field />
      </group>
    </Canvas>
  );
}
