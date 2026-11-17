// Animated TV screens: a small canvas redrawn a few times a second and fed
// to a CanvasTexture, so the office TVs feel alive without any video files.
// - 'office': a Mission Control dashboard — a scrolling line chart, bars and
//   a live clock (lounge TV and the meeting-room TV).
// - 'game': a retro brick-breaker with a bouncing ball (game-room TV).
// The desk monitors keep their static code screens: seven more live canvases
// would cost more than they add.

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

const WIDTH = 256
const HEIGHT = 160

function drawOffice(ctx: CanvasRenderingContext2D, history: number[], now: number) {
  ctx.fillStyle = '#0d2733'; ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.fillStyle = '#123543'; ctx.fillRect(0, 0, WIDTH, 24)
  ctx.fillStyle = '#7ee0c3'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText('ISA · LIVE', 8, 13)
  const clock = new Date()
  ctx.fillStyle = '#f2c58a'; ctx.textAlign = 'right'
  ctx.fillText(`${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`, WIDTH - 8, 13)
  // Scrolling line chart: one new point per redraw, oldest drops off.
  history.push(0.5 + 0.3 * Math.sin(now * 0.7) + 0.12 * Math.sin(now * 2.3))
  if (history.length > 40) history.shift()
  ctx.strokeStyle = '#55d5ff'; ctx.lineWidth = 2; ctx.beginPath()
  history.forEach((value, index) => {
    const x = 8 + (index / 39) * (WIDTH - 16)
    const y = 96 - value * 58
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.strokeStyle = 'rgba(85,213,255,0.25)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(8, 96); ctx.lineTo(WIDTH - 8, 96); ctx.stroke()
  // Bars, gently breathing.
  const colors = ['#e9c46a', '#2a9d8f', '#e76f51', '#8fd18a']
  colors.forEach((color, index) => {
    const height = 14 + 16 * (0.5 + 0.5 * Math.sin(now * 0.9 + index * 1.4))
    ctx.fillStyle = color
    ctx.fillRect(14 + index * 60, 150 - height, 34, height)
  })
  ctx.fillStyle = '#e7e7e7'; ctx.font = '11px monospace'; ctx.textAlign = 'left'
  ctx.fillText('7 agen · kerja nyata', 8, 140)
}

function drawGame(ctx: CanvasRenderingContext2D, now: number) {
  ctx.fillStyle = '#0b1026'; ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const colors = ['#e63946', '#f4a261', '#f4d35e', '#2a9d8f', '#3a86ff']
  colors.forEach((color, row) => {
    ctx.fillStyle = color
    for (let col = 0; col < 8; col += 1) ctx.fillRect(6 + col * 31, 10 + row * 14, 27, 10)
  })
  const ballX = 128 + 96 * Math.sin(now * 0.9)
  const ballY = 96 + 26 * Math.sin(now * 1.7)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(ballX - 4, ballY - 4, 8, 8)
  ctx.fillRect(ballX - 26, 148, 52, 6)
  ctx.fillStyle = '#f4d35e'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'
  ctx.fillText(`SKOR ${String(Math.floor(now) % 100).padStart(2, '0')}`, 8, 152)
}

export function AnimatedScreen({ position, width, height, variant = 'office' }: { position?: [number, number, number]; width: number; height: number; variant?: 'office' | 'game' }) {
  const canvas = useMemo(() => {
    const element = document.createElement('canvas')
    element.width = WIDTH
    element.height = HEIGHT
    return element
  }, [])
  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [canvas])
  const history = useRef<number[]>([])
  const last = useRef(-1)
  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    const interval = variant === 'game' ? 0.1 : 0.45
    if (now - last.current < interval) return
    last.current = now
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (variant === 'game') drawGame(ctx, now)
    else drawOffice(ctx, history.current, now)
    texture.needsUpdate = true
  })
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={position}>
    <planeGeometry args={[width, height]}/>
    <meshStandardMaterial map={texture} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.55} roughness={0.2}/>
  </mesh>
}
