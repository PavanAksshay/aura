"use client";

/**
 * The Aura orb: two counter-rotating particle shells (cyan core, violet halo)
 * with soft additive glow, gentle breathing, and pointer parallax. Rendered
 * with react-three-fiber; loaded client-only via components/landing/hero-orb.
 */

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Evenly distribute `count` points on a sphere (fibonacci lattice) + jitter. */
function sphericalCloud(count: number, radius: number, jitter: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const j = () => (Math.random() - 0.5) * jitter;
    positions[i * 3] = Math.cos(theta) * r * radius + j();
    positions[i * 3 + 1] = y * radius + j();
    positions[i * 3 + 2] = Math.sin(theta) * r * radius + j();
  }
  return positions;
}

const VERTEX = /* glsl */ `
  uniform float uSize;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (240.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function Shell({
  count,
  radius,
  jitter,
  color,
  size,
  opacity,
  speed,
  animate,
}: {
  count: number;
  radius: number;
  jitter: number;
  color: string;
  size: number;
  opacity: number;
  speed: number;
  animate: boolean;
}) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(
    () => sphericalCloud(count, radius, jitter),
    [count, radius, jitter],
  );
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uSize: { value: size },
      uOpacity: { value: opacity },
    }),
    [color, size, opacity],
  );

  useFrame((state, delta) => {
    if (!points.current || !animate) return;
    const t = state.clock.elapsedTime;
    points.current.rotation.y += delta * speed;
    points.current.rotation.x = Math.sin(t * 0.12) * 0.12;
    const breathe = 1 + Math.sin(t * 0.5) * 0.035;
    points.current.scale.setScalar(breathe);
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

function Scene({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null);

  // Pointer parallax: the whole orb leans softly toward the cursor.
  useFrame((state, delta) => {
    if (!group.current || !animate) return;
    const damp = 1 - Math.exp(-2.5 * delta);
    group.current.rotation.y +=
      (state.pointer.x * 0.35 - group.current.rotation.y) * damp;
    group.current.rotation.x +=
      (-state.pointer.y * 0.25 - group.current.rotation.x) * damp;
  });

  return (
    <group ref={group}>
      {/* Deeper tones + normal blending so the orb reads on a light page. */}
      <Shell
        count={1500}
        radius={2.1}
        jitter={0.06}
        color="#0e7490"
        size={0.055}
        opacity={0.55}
        speed={0.05}
        animate={animate}
      />
      <Shell
        count={800}
        radius={2.75}
        jitter={0.5}
        color="#7c3aed"
        size={0.05}
        opacity={0.35}
        speed={-0.03}
        animate={animate}
      />
      <Shell
        count={300}
        radius={1.2}
        jitter={0.35}
        color="#0d9488"
        size={0.065}
        opacity={0.65}
        speed={0.08}
        animate={animate}
      />
    </group>
  );
}

export default function AuraOrb() {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <Canvas
      camera={{ position: [0, 0, 6.5], fov: 50 }}
      dpr={[1, 1.4]}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      frameloop={reducedMotion ? "demand" : "always"}
      aria-hidden
    >
      <Scene animate={!reducedMotion} />
    </Canvas>
  );
}
