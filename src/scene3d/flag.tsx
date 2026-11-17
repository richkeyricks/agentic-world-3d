// The Merah Putih flag, waving on a sine shader instead of a CPU vertex
// loop: one time uniform, the wave is computed on the GPU. The cloth hangs
// from the pole (x = 0) and the free end (x = 1.2) waves the most.

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '../office3d-layout.ts'
import { merahPutih } from './textures.ts'

type ShaderWithTime = { uniforms: { uTime: { value: number } } }

export function FlagCloth({ position }: { position: Vec3 }) {
  const texture = useMemo(() => merahPutih(), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(1.2, 0.8, 16, 8).translate(0.6, 0, 0), [])
  const shader = useRef<ShaderWithTime | null>(null)
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 0.8 })
    mat.onBeforeCompile = (compiled) => {
      compiled.uniforms.uTime = { value: 0 }
      shader.current = compiled as unknown as ShaderWithTime
      compiled.vertexShader = `uniform float uTime;\n${compiled.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float sway = position.x / 1.2;
        transformed.z += sin(position.x * 4.0 + uTime * 3.0) * 0.09 * sway;
        transformed.y += sin(position.x * 2.2 + uTime * 2.1) * 0.025 * sway;`,
      )}`
    }
    mat.customProgramCacheKey = () => 'flag-wave'
    return mat
  }, [texture])
  useFrame(({ clock }) => {
    if (shader.current) shader.current.uniforms.uTime.value = clock.elapsedTime
  })
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])
  return <mesh position={position} geometry={geometry} material={material} castShadow/>
}
