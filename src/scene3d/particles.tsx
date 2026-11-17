// Ambient particles: one THREE.Points draw call for the whole scene.
// - Day: warm dust drifting over the grounds (subtle, always on).
// - Night: the same points become fireflies — greener, brighter, twinkling.
// - Always: steam rising from the bakso cart and the kopi bike.
// All motion is computed in the vertex shader from a time uniform, so the
// CPU cost per frame is one uniform update. The count adapts to the screen
// (800 / 2000 / 4000) and the layout is deterministic (seeded), so it looks
// the same on every load.

import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OfficeLayout, Vec3 } from '../office3d-layout.ts'
import { nightAmount, particleCountForWidth } from './day-night.tsx'
import { radialTexture } from './textures.ts'

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  attribute float aSize;
  attribute float aKind;
  varying float vAlpha;
  varying float vKind;
  varying float vTwinkle;
  void main() {
    vec3 p = position;
    float grow = 1.0;
    if (aKind > 0.5) {
      // Steam: rise from the cart, drift a little, grow and fade out.
      float rise = mod(uTime * (0.22 + aSeed * 0.18) + aSeed * 1.7, 1.0);
      p.y += rise * 1.5;
      p.x += sin(rise * 6.0 + aSeed * 20.0) * 0.12 * rise;
      grow = 1.0 + rise * 1.8;
      vAlpha = (1.0 - rise) * 0.28;
      vTwinkle = 0.0;
    } else {
      // Dust / fireflies: slow wander and a gentle bob.
      p.x += sin(uTime * 0.12 + aSeed * 17.0) * 1.1;
      p.z += cos(uTime * 0.10 + aSeed * 23.0) * 1.1;
      p.y += sin(uTime * 0.22 + aSeed * 31.0) * 0.3;
      vAlpha = 1.0;
      vTwinkle = 0.5 + 0.5 * sin(uTime * 1.6 + aSeed * 43.0);
    }
    vKind = aKind;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * grow * uPixelRatio * (240.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uNight;
  varying float vAlpha;
  varying float vKind;
  varying float vTwinkle;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    vec3 color;
    float alpha;
    if (vKind > 0.5) {
      color = vec3(1.0);
      alpha = vAlpha;
    } else {
      // Warm dust by day, green-yellow fireflies by night (brighter, twinkling).
      color = mix(vec3(1.0, 0.91, 0.68), vec3(0.82, 0.98, 0.55), uNight);
      alpha = mix(0.22, 0.25 + 0.55 * vTwinkle, uNight);
    }
    gl_FragColor = vec4(color, tex.a * alpha);
    if (gl_FragColor.a < 0.01) discard;
  }
`

/** Deterministic pseudo-random numbers, so the particle layout is stable. */
function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

interface ParticleData { positions: Float32Array; seeds: Float32Array; sizes: Float32Array; kinds: Float32Array }

/** 70% ambient dust/fireflies over the grounds, 30% steam above the two carts. */
export function buildParticles(count: number, bakso: Vec3, kopi: Vec3): ParticleData {
  const rand = seededRandom(29)
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  const kinds = new Float32Array(count)
  const steamCount = Math.round(count * 0.3)
  for (let index = 0; index < count; index += 1) {
    const seed = rand()
    seeds[index] = seed
    if (index < steamCount) {
      // Steam: half above the bakso dandang, half above the kopi thermoses.
      const cart = index % 2 === 0 ? bakso : kopi
      positions[index * 3] = cart[0] + (rand() - 0.5) * 0.3
      positions[index * 3 + 1] = 1.5 + rand() * 0.2
      positions[index * 3 + 2] = cart[2] + (rand() - 0.5) * 0.3
      sizes[index] = 0.55 + rand() * 0.35
      kinds[index] = 1
    } else {
      positions[index * 3] = -16 + rand() * 46
      positions[index * 3 + 1] = 0.3 + rand() * 6.5
      positions[index * 3 + 2] = -6 + rand() * 21
      sizes[index] = 0.12 + rand() * 0.18
      kinds[index] = 0
    }
  }
  return { positions, seeds, sizes, kinds }
}

export function AmbientParticles({ layout }: { layout: OfficeLayout }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const gl = useThree((state) => state.gl)
  const data = useMemo(() => {
    const width = typeof window === 'undefined' ? 1280 : window.innerWidth
    return buildParticles(particleCountForWidth(width), layout.baksoCart, layout.kopiBike)
    // The carts only move when the crew size changes (layout key), so the
    // particle field is rebuilt exactly when it has to be.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.baksoCart, layout.kopiBike])
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(data.seeds, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1))
    geo.setAttribute('aKind', new THREE.BufferAttribute(data.kinds, 1))
    return geo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPixelRatio: { value: gl.getPixelRatio() },
    uNight: { value: 0 },
    uMap: { value: radialTexture() },
  }), [gl])
  useFrame(({ clock }) => {
    const mat = material.current
    if (!mat) return
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uNight.value = nightAmount.current
  })
  return <points geometry={geometry} frustumCulled={false}>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={VERTEX} fragmentShader={FRAGMENT} transparent depthWrite={false}/>
  </points>
}
