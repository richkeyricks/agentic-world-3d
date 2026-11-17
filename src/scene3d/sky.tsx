// Sky gradient dome: a large inverted sphere whose shader blends a horizon
// colour into a top colour. Zero bundle (hand-rolled ShaderMaterial), no fog
// on the sky itself, and both colours fade with the day→night transition.
// The dome (radius 140) always encloses the camera: the orbit target never
// goes further than ~72 from the scene centre, and the camera far plane is 400
// (the dome's far side can sit ~260 from the camera, so a shorter far plane
// clips it and leaves a hard diagonal seam of bare background colour).

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DAY_NIGHT, lerpHex, nightAmount } from './day-night.tsx'

const VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`

const FRAGMENT = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    float t = pow(max(h, 0.0), 0.55);
    gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0);
  }
`

export function SkyDome() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uTop: { value: new THREE.Color(DAY_NIGHT.sky.topDay) },
    uHorizon: { value: new THREE.Color(DAY_NIGHT.sky.horizonDay) },
  }), [])
  useFrame(() => {
    const t = nightAmount.current
    lerpHex(uniforms.uTop.value, DAY_NIGHT.sky.topDay, DAY_NIGHT.sky.topNight, t)
    lerpHex(uniforms.uHorizon.value, DAY_NIGHT.sky.horizonDay, DAY_NIGHT.sky.horizonNight, t)
  })
  return <mesh frustumCulled={false} renderOrder={-1}>
    <sphereGeometry args={[140, 32, 16]}/>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={VERTEX} fragmentShader={FRAGMENT} side={THREE.BackSide} depthWrite={false}/>
  </mesh>
}
