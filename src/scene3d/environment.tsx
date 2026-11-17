import { useMemo, useRef } from 'react'
import type * as THREE from 'three'
import { ARCADES, BALCONY, BALCONY_DOOR, BALCONY_TABLE, BATHROOM, BEANBAGS, CARROM, COFFEE_TABLE, ENTRANCE_X, FLAG, FLOOR_HEIGHT, type Floor as FloorNumber, GAME_DOOR, GAME_ROOM, GAME_TV, HAMMOCK, LESEHAN_TABLE, LOUNGE_PARTITION_END_Z, MEETING_DOOR_X, PARTITION_X, PING_PONG, SOFA, STAIRS, STALL_ROTATION, type OfficeLayout, TV, type Vec3 } from '../office3d-layout.ts'
import { AcOutdoorUnit, AirConditioner, ArcadeCabinet, Armchair, BathroomFittings, Beanbag, Bed, Bookshelf, CarromTable, ClothesLine, CoffeeTable, Cyl, FlagPole, FloorCushion, FoodCart, Fridge, GalonDispenser, Gerobak, GuardPost, Hammock, KopiSepeda, LongTable, LowTable, Nightstand, OfficeChair, OfficeLight, PantryCounter, Pengamen, Pengemis, PingPongTable, Plant, Railing, RattanChair, RBox, Satpam, SideTable, Sofa, Staircase, StreetLamp, StringLights, Television, Tree, Vendor, WallClock, Wardrobe, WaterTank, Whiteboard } from './props.tsx'
import { useNightMaterial } from './day-night.tsx'
import { asphalt, carpet, grass, pavingStones, signTexture, signTextureFit, tileFloor, woodFloor } from './textures.ts'

// The building (floors, walls, windows, furniture) and its surroundings (yard, sidewalk,
// street food, the flag and the road). In the evening (dark theme) the lamps come on. Walls facing the camera are kept low, like a
// cut-away dollhouse, so the inside stays visible from any angle the controls allow.

const WALL = '#efe6d6'
const WALL_TOP = '#d9cdb8'
const WALL_HEIGHT = 2.6
const THICK = 0.25

function Floor({ position, size, map, color = '#ffffff', roughness = 0.8 }: { position: Vec3; size: [number, number]; map?: ReturnType<typeof woodFloor>; color?: string; roughness?: number }) {
  return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={size}/>
    <meshStandardMaterial map={map} color={color} roughness={roughness}/>
  </mesh>
}

function Wall({ from, to, height = WALL_HEIGHT }: { from: [number, number]; to: [number, number]; height?: number }) {
  const [x1, z1] = from
  const [x2, z2] = to
  const length = Math.hypot(x2 - x1, z2 - z1)
  const angle = Math.atan2(z2 - z1, x2 - x1)
  return <group position={[(x1 + x2) / 2, 0, (z1 + z2) / 2]} rotation={[0, -angle, 0]}>
    <RBox position={[0, height / 2, 0]} size={[length + THICK, height, THICK]} radius={0.02} color={WALL} roughness={0.9}/>
    <RBox position={[0, height + 0.02, 0]} size={[length + THICK + 0.02, 0.05, THICK + 0.04]} radius={0.01} color={WALL_TOP}/>
  </group>
}

/** A window: blue sky reflection by day, warm lamplight by night (fades with the day→night transition). */
function Window({ position, width = 1.8 }: { position: Vec3; width?: number }) {
  const glass = useRef<THREE.MeshStandardMaterial>(null)
  useNightMaterial(glass, '#6fb6d6', '#ffb85c', 0.35, 1.1)
  return <group position={position}>
    <RBox position={[0, 0, 0]} size={[width + 0.12, 1.22, 0.12]} radius={0.02} color="#5a4636"/>
    <mesh position={[0, 0, 0.065]}><planeGeometry args={[width, 1.1]}/><meshStandardMaterial ref={glass} color="#9fd3ea" emissive="#6fb6d6" emissiveIntensity={0.35} roughness={0.05} metalness={0.2}/></mesh>
    <RBox position={[0, 0, 0.08]} size={[0.05, 1.1, 0.03]} radius={0.01} color="#5a4636"/>
  </group>
}

/** A glass pane along x = const, from `bottom` up to near the top of the walls. */
function Glass({ x, fromZ, toZ, bottom }: { x: number; fromZ: number; toZ: number; bottom: number }) {
  const top = WALL_HEIGHT - 0.2
  return <RBox position={[x, (bottom + top) / 2, (fromZ + toZ) / 2]} size={[0.05, top - bottom, Math.abs(toZ - fromZ)]} radius={0.01} color="#cfe8ee" opacity={0.25} roughness={0.05} shadow={false}/>
}

/** The game room wing: ping-pong, arcade machines, a console corner and a karambol board. */
function GameRoom() {
  const { minX, maxX, minZ, maxZ } = GAME_ROOM
  const floor = useMemo(() => carpet('#3b4170', [3, 3]), [])
  return <group>
    <Floor position={[(minX + maxX) / 2, 0.006, (minZ + maxZ) / 2]} size={[maxX - minX, maxZ - minZ]} map={floor} roughness={0.9}/>
    <Wall from={[minX, minZ]} to={[maxX, minZ]}/>
    <Wall from={[maxX, minZ]} to={[maxX, maxZ]}/>
    <Wall from={[minX, maxZ]} to={[maxX, maxZ]} height={0.55}/>
    <group rotation={[0, -Math.PI / 2, 0]} position={[maxX - 0.14, 1.55, -2.2]}><Window position={[0, 0, 0]} width={1.6}/></group>
    <PingPongTable position={PING_PONG}/>
    {ARCADES.map((position, index) => <ArcadeCabinet key={index} position={position} color={index === 0 ? '#c62828' : '#1d4ed8'}/>)}
    <RBox position={[GAME_TV[0], 0.25, GAME_TV[2] + 0.2]} size={[1.8, 0.5, 0.4]} radius={0.03} color="#1f2328"/>
    <RBox position={[GAME_TV[0] - 0.3, 0.55, GAME_TV[2] + 0.2]} size={[0.36, 0.08, 0.26]} radius={0.02} color="#f2f2f2"/>
    <Television position={[GAME_TV[0], 1.35, GAME_TV[2] + 0.02]} variant="game"/>
    {BEANBAGS.map((position, index) => <Beanbag key={index} position={position} color={index === 0 ? '#e76f51' : '#2a9d8f'}/>)}
    <CarromTable position={CARROM}/>
    <Plant position={[maxX - 0.5, 0, maxZ - 0.5]} size={0.9}/>
    <AirConditioner position={[(minX + maxX) / 2 - 0.6, 2.3, minZ + 0.125]}/>
    {[[PING_PONG[0], 2.4, PING_PONG[2]], [ARCADES[0][0] + 0.5, 2.4, -3.6], [GAME_TV[0], 2.4, -3.6]].map((position) => <OfficeLight key={position.join(',')} position={position as Vec3}/>)}
  </group>
}

function Building({ layout }: { layout: OfficeLayout }) {
  const { minX, maxX, minZ, maxZ } = layout.building
  const wood = useMemo(() => woodFloor([4, 4]), [])
  const tiles = useMemo(() => tileFloor([3, 5]), [])
  const rug = useMemo(() => carpet('#5b7c8c', [2, 2]), [])
  const meetingRug = useMemo(() => carpet('#8a4b3c', [2, 2]), [])
  return <group>
    {/* Floors: parquet everywhere, tiles in the pantry, rugs in the lounge and meeting area */}
    <Floor position={[(minX + maxX) / 2, 0.005, (minZ + maxZ) / 2]} size={[maxX - minX, maxZ - minZ]} map={wood} roughness={0.55}/>
    <Floor position={[8.35, 0.01, 1.4]} size={[2.3, 5.4]} map={tiles} roughness={0.35}/>
    <Floor position={[4.6, 0.012, -2.9]} size={[4.4, 2.8]} map={rug}/>
    <Floor position={[(layout.meetingRoom.minX + layout.meetingRoom.maxX) / 2, 0.012, (layout.meetingRoom.minZ + layout.meetingRoom.maxZ) / 2]} size={[layout.meetingRoom.maxX - layout.meetingRoom.minX - 0.3, layout.meetingRoom.maxZ - layout.meetingRoom.minZ - 0.3]} map={meetingRug}/>
    {/* Full-height back and left walls, low walls towards the camera */}
    <Wall from={[minX, minZ]} to={[maxX, minZ]}/>
    <Wall from={[minX, minZ]} to={[minX, maxZ]}/>
    {/* Right wall: the lounge side opens into the game room through a door, glass above */}
    <Wall from={[maxX, minZ]} to={[maxX, GAME_DOOR.fromZ]} height={1.1}/>
    <Wall from={[maxX, GAME_DOOR.toZ]} to={[maxX, maxZ]} height={1.1}/>
    <Glass x={maxX} fromZ={minZ} toZ={GAME_DOOR.fromZ} bottom={1.1}/>
    <Glass x={maxX} fromZ={GAME_DOOR.toZ} toZ={GAME_ROOM.maxZ} bottom={1.1}/>
    {/* Glass partition that makes the lounge its own room */}
    <Wall from={[PARTITION_X, minZ]} to={[PARTITION_X, LOUNGE_PARTITION_END_Z]} height={0.9}/>
    <Glass x={PARTITION_X} fromZ={minZ} toZ={LOUNGE_PARTITION_END_Z} bottom={0.9}/>
    <Wall from={[minX, maxZ]} to={[4.9, maxZ]} height={0.55}/>
    <Wall from={[6.7, maxZ]} to={[maxX, maxZ]} height={0.55}/>
    {/* Meeting room: glass-topped half walls with a door by the aisle, and a planter row by the lounge */}
    <MeetingRoom layout={layout}/>
    {[1.3, 2.3, 3.3].map((z) => <Plant key={z} position={[0.9, 0, z]} size={0.8}/>)}
    {/* Windows on the back and left walls */}
    {[-7, -3.6, 1.4, 6.6].map((x) => <Window key={x} position={[x, 1.55, minZ + 0.14]}/>)}
    {[-3].map((z) => <group key={z} rotation={[0, Math.PI / 2, 0]} position={[minX + 0.14, 1.55, z]}><Window position={[0, 0, 0]} width={1.6}/></group>)}
    {/* Workspace */}
    <Bookshelf position={[minX + 0.35, 0, -0.9]} rotation={Math.PI / 2}/>
    <Plant position={[minX + 0.5, 0, -4.6]}/>
    <Plant position={[-0.4, 0, -4.7]} size={0.9}/>
    <WallClock position={[-3.6, 2.35, minZ + 0.14]}/>
    {/* Lounge */}
    <Sofa position={SOFA} rotation={Math.PI}/>
    {/* Armchairs sit exactly behind the lounge seats agents use (LOUNGE_SEATS 2 and 3) */}
    <Armchair position={[2.1, 0, -2.9]} rotation={Math.PI / 2} color="#d9784a"/>
    <Armchair position={[7.1, 0, -2.9]} rotation={-Math.PI / 2} color="#3d7fd6"/>
    <CoffeeTable position={COFFEE_TABLE}/>
    <RBox position={[TV[0], 0.3, TV[2]]} size={[1.8, 0.6, 0.45]} radius={0.03} color="#6b4a32"/>
    <Television position={[TV[0], 1.35, minZ + 0.17]}/>
    <Plant position={[2.1, 0, -4.6]}/>
    {/* Pantry: galon dispenser, fridge and counter */}
    <GalonDispenser position={[maxX - 0.45, 0, -0.4]} rotation={-Math.PI / 2}/>
    <Fridge position={[maxX - 0.5, 0, 0.6]} rotation={-Math.PI / 2}/>
    <PantryCounter position={[maxX - 0.45, 0, 2.6]} rotation={-Math.PI / 2}/>
    {/* Split ACs high on the walls */}
    <AirConditioner position={[-5.3, 2.3, minZ + 0.125]}/>
    <AirConditioner position={[TV[0], 2.3, minZ + 0.125]}/>
    <AirConditioner position={[minX + 0.125, 2.3, 2.6]} rotation={Math.PI / 2}/>
    {/* Office lights: suspended cool-white LED bars */}
    {[...layout.desks.map(([x, , z]): Vec3 => [x, 2.4, z + 0.2]),  [(layout.meetingRoom.table.x1 + layout.meetingRoom.table.x2) / 2, 2.4, layout.meetingRoom.table.z] as Vec3, [COFFEE_TABLE[0], 2.4, COFFEE_TABLE[2] + 0.4] as Vec3, [8.2, 2.4, 1.2] as Vec3].map((position) => <OfficeLight key={position.join(',')} position={position}/>)}
    <Stairs/>
    <GameRoom/>
  </group>
}

/** A glass pane along z = const, from `bottom` to near the top of the walls. */
function GlassAlongX({ z, fromX, toX, bottom }: { z: number; fromX: number; toX: number; bottom: number }) {
  const top = WALL_HEIGHT - 0.2
  return <RBox position={[(fromX + toX) / 2, (bottom + top) / 2, z]} size={[Math.abs(toX - fromX), top - bottom, 0.05]} radius={0.01} color="#cfe8ee" opacity={0.25} roughness={0.05} shadow={false}/>
}

/** The meeting room: long table and chairs, a TV showing a live dashboard on the left wall, a whiteboard. */
function MeetingRoom({ layout }: { layout: OfficeLayout }) {
  const { minX, maxX, minZ, maxZ, table, tv, whiteboard, seats } = layout.meetingRoom
  const door = { from: MEETING_DOOR_X - 0.45, to: MEETING_DOOR_X + 0.45 }
  const chairs = seats.filter((seat) => seat.seated)
  return <group>
    {/* Right wall towards the lounge side, and the aisle-side wall with its door */}
    <Wall from={[maxX, minZ]} to={[maxX, maxZ]} height={0.9}/>
    <Glass x={maxX} fromZ={minZ} toZ={maxZ} bottom={0.9}/>
    {/* Its own left wall when the room is narrower than the building */}
    {minX > layout.building.minX + 0.1 && <><Wall from={[minX, minZ]} to={[minX, maxZ]} height={0.9}/><Glass x={minX} fromZ={minZ} toZ={maxZ} bottom={0.9}/></>}
    <Wall from={[minX, minZ]} to={[door.from, minZ]} height={0.9}/>
    <Wall from={[door.to, minZ]} to={[maxX, minZ]} height={0.9}/>
    <GlassAlongX z={minZ} fromX={minX} toX={door.from} bottom={0.9}/>
    <GlassAlongX z={minZ} fromX={door.to} toX={maxX} bottom={0.9}/>
    <RBox position={[MEETING_DOOR_X, WALL_HEIGHT - 0.15, minZ]} size={[0.95, 0.1, 0.12]} radius={0.02} color={WALL_TOP}/>
    <LongTable position={[(table.x1 + table.x2) / 2, 0, table.z]} length={table.x2 - table.x1}/>
    {chairs.map(({ position: [x, , z], facing }) => <OfficeChair key={`${x},${z}`} position={[x, 0, z]} rotation={facing}/>)}
    {/* TV on a stand at the table's left end, showing a live dashboard */}
    <group position={[tv[0], 0, tv[2]]} rotation={[0, Math.PI / 2, 0]}>
      <RBox position={[0, 0.03, 0]} size={[0.9, 0.05, 0.5]} radius={0.02} color="#2a2f33"/>
      <RBox position={[0, 0.75, -0.08]} size={[0.1, 1.45, 0.08]} radius={0.02} color="#3a3f44" metalness={0.5}/>
      <group position={[0, 1.45, 0]}>
      <Television position={[0, 0, 0]}/>
      </group>
    </group>
    <Whiteboard position={whiteboard} rotation={-Math.PI / 2}/>
    <Plant position={[maxX - 0.4, 0, maxZ - 0.45]} size={0.8}/>
  </group>
}

function Stairs() {
  return <Staircase position={[STAIRS.lowX, 0, STAIRS.z]} run={STAIRS.highX - STAIRS.lowX} rise={FLOOR_HEIGHT} width={STAIRS.width}/>
}

/** A glass pane along z = const (front walls), from `bottom` to `top`. */
function GlassZ({ z, fromX, toX, bottom, top }: { z: number; fromX: number; toX: number; bottom: number; top: number }) {
  return <RBox position={[(fromX + toX) / 2, (bottom + top) / 2, z]} size={[Math.abs(toX - fromX), top - bottom, 0.05]} radius={0.01} color="#cfe8ee" opacity={0.25} roughness={0.05} shadow={false}/>
}

/**
 * Lantai 1 seen from lantai 2: the building closed up to full height (no cut-away), the game room
 * with its roof and tandon air, and the stairs visible through the stairwell.
 */
function BuildingShell({ layout }: { layout: OfficeLayout }) {
  const { minX, maxX, minZ, maxZ } = layout.building
  const g = GAME_ROOM
  return <group>
    <Wall from={[minX, minZ]} to={[maxX, minZ]}/>
    <Wall from={[minX, minZ]} to={[minX, maxZ]}/>
    <Wall from={[maxX, minZ]} to={[maxX, maxZ]}/>
    <Wall from={[minX, maxZ]} to={[4.9, maxZ]}/>
    <Wall from={[6.7, maxZ]} to={[maxX, maxZ]}/>
    {/* Glass entrance doors and shop windows facing the street */}
    <GlassZ z={maxZ} fromX={4.9} toX={6.7} bottom={0} top={2.3}/>
    <RBox position={[ENTRANCE_X, 2.45, maxZ]} size={[1.9, 0.3, 0.3]} radius={0.02} color={WALL_TOP}/>
    {[-7, -3.6, -0.2, 2.6, 8.1].filter((x) => x > minX + 1).map((x) => <Window key={x} position={[x, 1.45, maxZ + 0.14]}/>)}
    {[-3, 0.6, 3].map((z) => <group key={z} rotation={[0, -Math.PI / 2, 0]} position={[minX - 0.14, 1.45, z]}><Window position={[0, 0, 0]} width={1.6}/></group>)}
    {/* Game room: full walls and a flat roof with the water tank */}
    <Wall from={[g.minX, g.minZ]} to={[g.maxX, g.minZ]}/>
    <Wall from={[g.maxX, g.minZ]} to={[g.maxX, g.maxZ]}/>
    <Wall from={[g.minX, g.maxZ]} to={[g.maxX, g.maxZ]}/>
    {[11, 13.8].map((x) => <Window key={x} position={[x, 1.45, g.maxZ + 0.14]} width={1.4}/>)}
    <RBox position={[(g.minX + g.maxX) / 2, WALL_HEIGHT + 0.08, (g.minZ + g.maxZ) / 2]} size={[g.maxX - g.minX + 0.3, 0.16, g.maxZ - g.minZ + 0.3]} radius={0.02} color="#9a9a94" roughness={0.95}/>
    <WaterTank position={[14.2, WALL_HEIGHT + 0.16, -3.8]}/>
    <AcOutdoorUnit position={[11.2, WALL_HEIGHT + 0.16, -4.3]}/>
    <Stairs/>
  </group>
}

/** Lantai 2: dorm bedroom, lesehan corner, bathroom, and the balcony over the front. */
function UpperFloor({ layout }: { layout: OfficeLayout }) {
  const { minX, maxX, minZ, maxZ } = layout.building
  const wood = useMemo(() => woodFloor([4, 4]), [])
  const bedroomRug = useMemo(() => carpet('#6d5a8c', [3, 3]), [])
  const lesehanRug = useMemo(() => carpet('#8c3b3b', [2, 2]), [])
  const tiles = useMemo(() => tileFloor([2, 2]), [])
  const balconyTiles = useMemo(() => tileFloor([6, 1]), [])
  // The slab, leaving the stairwell open: [minX, maxX, minZ, maxZ] pieces.
  const hole = { minX: STAIRS.highX, maxX: STAIRS.lowX, minZ: STAIRS.z - STAIRS.width / 2 - 0.05, maxZ: STAIRS.z + STAIRS.width / 2 + 0.05 }
  const slab: [number, number, number, number][] = [
    [minX, maxX, minZ, hole.minZ], [minX, hole.minX, hole.minZ, hole.maxZ], [hole.maxX, maxX, hole.minZ, hole.maxZ], [minX, maxX, hole.maxZ, maxZ],
    [minX, maxX, BALCONY.minZ, BALCONY.maxZ],
  ]
  const blankets = ['#3d7fd6', '#e76f51', '#2a9d8f', '#e9c46a', '#8d5bc1', '#d64545']
  const doorX = (BALCONY_DOOR.fromX + BALCONY_DOOR.toX) / 2
  const balconyPosts = [minX + 0.15, (minX + maxX) / 2, maxX - 0.15]
  const H = FLOOR_HEIGHT
  return <group>
    {/* Balcony columns down to the sidewalk (ruko style) and the frame for the string lights */}
    {balconyPosts.map((x) => <RBox key={x} position={[x, (H + 2.3) / 2, BALCONY.maxZ - 0.12]} size={[0.18, H + 2.3, 0.18]} radius={0.02} color={WALL}/>)}
    <RBox position={[(minX + maxX) / 2, H + 2.3, BALCONY.maxZ - 0.12]} size={[maxX - minX, 0.12, 0.14]} radius={0.02} color={WALL_TOP}/>
    <group position={[0, H, 0]}>
      {slab.map(([x1, x2, z1, z2]) => <RBox key={`${x1},${z1}`} position={[(x1 + x2) / 2, -0.11, (z1 + z2) / 2]} size={[x2 - x1, 0.22, z2 - z1]} radius={0.01} color="#cfc6b5"/>)}
      {slab.slice(0, 4).map(([x1, x2, z1, z2]) => <Floor key={`f${x1},${z1}`} position={[(x1 + x2) / 2, 0.005, (z1 + z2) / 2]} size={[x2 - x1, z2 - z1]} map={wood} roughness={0.55}/>)}
      <Floor position={[(minX + maxX) / 2, 0.005, (BALCONY.minZ + BALCONY.maxZ) / 2]} size={[maxX - minX, BALCONY.maxZ - BALCONY.minZ]} map={balconyTiles} roughness={0.5}/>
      <Floor position={[(minX + PARTITION_X) / 2, 0.012, -2.4]} size={[PARTITION_X - minX - 0.4, 5]} map={bedroomRug}/>
      <Floor position={[LESEHAN_TABLE[0], 0.012, LESEHAN_TABLE[2]]} size={[3.4, 2.8]} map={lesehanRug}/>
      <Floor position={[(BATHROOM.minX + BATHROOM.maxX) / 2, 0.012, (BATHROOM.minZ + BATHROOM.maxZ) / 2]} size={[BATHROOM.maxX - BATHROOM.minX, BATHROOM.maxZ - BATHROOM.minZ]} map={tiles} roughness={0.3}/>
      {/* Walls: full at the back and sides, glass sliding doors onto the balcony */}
      <Wall from={[minX, minZ]} to={[maxX, minZ]}/>
      <Wall from={[minX, minZ]} to={[minX, maxZ]}/>
      <Wall from={[maxX, minZ]} to={[maxX, maxZ]}/>
      <Wall from={[minX, maxZ]} to={[BALCONY_DOOR.fromX, maxZ]} height={0.3}/>
      <Wall from={[BALCONY_DOOR.toX, maxZ]} to={[maxX, maxZ]} height={0.3}/>
      <GlassZ z={maxZ} fromX={minX} toX={BALCONY_DOOR.fromX} bottom={0.3} top={2.2}/>
      <GlassZ z={maxZ} fromX={BALCONY_DOOR.toX} toX={maxX} bottom={0.3} top={2.2}/>
      {[-6, -2.4, 2.6].filter((x) => x > minX + 1).map((x) => <Window key={x} position={[x, 1.55, minZ + 0.14]}/>)}
      <group rotation={[0, -Math.PI / 2, 0]} position={[maxX - 0.14, 1.55, 0.6]}><Window position={[0, 0, 0]} width={1.6}/></group>
      {/* Bedroom: one bed per agent, a glass partition, wardrobes and bedside tables */}
      <Wall from={[PARTITION_X, minZ]} to={[PARTITION_X, LOUNGE_PARTITION_END_Z]} height={0.9}/>
      <Glass x={PARTITION_X} fromZ={minZ} toZ={LOUNGE_PARTITION_END_Z} bottom={0.9}/>
      {layout.beds.map(([x, , z], index) => <Bed key={index} position={[x, 0, z]} color={blankets[index % blankets.length]}/>)}
      {layout.beds.filter(([, , z]) => z < -3).map(([x], index) => <Nightstand key={index} position={[x - 0.85, 0, minZ + 0.4]}/>)}
      <Wardrobe position={[minX + 0.4, 0, 1.4]} rotation={Math.PI / 2}/>
      <Wardrobe position={[minX + 0.4, 0, 2.8]} rotation={Math.PI / 2}/>
      <AirConditioner position={[(minX + PARTITION_X) / 2, 2.3, minZ + 0.125]}/>
      {/* Lesehan corner */}
      <LowTable position={[LESEHAN_TABLE[0], 0, LESEHAN_TABLE[2]]}/>
      {[[-1, 0, '#e9c46a'], [1, 0, '#2a9d8f'], [0, -0.85, '#e76f51'], [0, 0.85, '#3d7fd6']].map(([dx, dz, color]) => <FloorCushion key={color as string} position={[LESEHAN_TABLE[0] + (dx as number), 0, LESEHAN_TABLE[2] + (dz as number)]} color={color as string}/>)}
      <Bookshelf position={[6.5, 0, minZ + 0.3]}/>
      <Plant position={[1.1, 0, minZ + 0.5]} size={0.9}/>
      <Plant position={[7.1, 0, 1.4]}/>
      {/* Bathroom: kamar mandi with a bak mandi */}
      <Wall from={[BATHROOM.minX, minZ]} to={[BATHROOM.minX, BATHROOM.maxZ]} height={1.9}/>
      <Wall from={[BATHROOM.minX, BATHROOM.maxZ]} to={[8, BATHROOM.maxZ]} height={1}/>
      <Wall from={[8.9, BATHROOM.maxZ]} to={[maxX, BATHROOM.maxZ]} height={1}/>
      <BathroomFittings position={[8.2, 0, -2.6]}/>
      {/* Railing around the stairwell */}
      <Railing position={[(hole.minX + hole.maxX) / 2, 0, hole.minZ]} length={hole.maxX - hole.minX}/>
      <Railing position={[hole.maxX, 0, STAIRS.z]} length={hole.maxZ - hole.minZ} rotation={Math.PI / 2}/>
      {[...layout.beds.filter((_, index) => index % 2 === 0).map(([x, , z]): Vec3 => [x, 2.4, z + 0.6]), [LESEHAN_TABLE[0], 2.4, LESEHAN_TABLE[2]] as Vec3, [doorX, 2.4, 2] as Vec3].map((position) => <OfficeLight key={position.join(',')} position={position}/>)}
      {/* Balcony */}
      <Railing position={[(minX + maxX) / 2, 0, BALCONY.maxZ - 0.05]} length={maxX - minX}/>
      <Railing position={[minX + 0.05, 0, (BALCONY.minZ + BALCONY.maxZ) / 2]} length={BALCONY.maxZ - BALCONY.minZ} rotation={Math.PI / 2}/>
      <Railing position={[maxX - 0.05, 0, (BALCONY.minZ + BALCONY.maxZ) / 2]} length={BALCONY.maxZ - BALCONY.minZ} rotation={Math.PI / 2}/>
      <SideTable position={[BALCONY_TABLE[0], 0, BALCONY_TABLE[2]]}/>
      <RattanChair position={[BALCONY_TABLE[0] - 0.85, 0, BALCONY_TABLE[2]]} rotation={Math.PI / 2}/>
      <RattanChair position={[BALCONY_TABLE[0] + 0.85, 0, BALCONY_TABLE[2]]} rotation={-Math.PI / 2}/>
      <Hammock position={[HAMMOCK[0], 0, HAMMOCK[2]]}/>
      <ClothesLine position={[Math.max(minX + 1.6, -3.2), 0, 6.15]}/>
      <Plant position={[maxX - 0.5, 0, BALCONY.minZ + 0.5]} size={0.9}/>
      <Plant position={[minX + 0.5, 0, BALCONY.minZ + 0.5]} size={0.9}/>
      <StringLights position={[(minX + maxX) / 2, 2.15, BALCONY.maxZ - 0.12]} length={maxX - minX - 0.6}/>
    </group>
  </group>
}

/** A supermarket shelf: two boards with colourful goods. */
function MarketShelf({ position }: { position: Vec3 }) {
  const goods = ['#c62828', '#2f6f8f', '#e0a43a', '#4f8a4a', '#6a4d8d', '#d9784a']
  return <group position={position}>
    <RBox position={[-0.9, 0.55, 0]} size={[0.06, 1.1, 0.55]} radius={0.02} color="#6b4a32"/>
    <RBox position={[0.9, 0.55, 0]} size={[0.06, 1.1, 0.55]} radius={0.02} color="#6b4a32"/>
    <RBox position={[0, 0.55, 0]} size={[1.9, 0.06, 0.55]} radius={0.02} color="#8a6f4d"/>
    <RBox position={[0, 1.05, 0]} size={[1.9, 0.06, 0.55]} radius={0.02} color="#8a6f4d"/>
    {[0.58, 1.08].map((y, row) => [0, 1, 2, 3].map((i) => <RBox key={`${row}-${i}`} position={[-0.68 + i * 0.45, y + 0.14, 0]} size={[0.32, 0.28, 0.4]} radius={0.02} color={goods[(row * 4 + i) % goods.length]}/>))}
  </group>
}

/** Ricky Market: the supermarket next door (x 18..28), glass storefront, shelves, chillers. */
function RickyMarket() {
  const sign = useMemo(() => signTextureFit('RICKY MARKET', '#1b7a4d', '#ffffff', 'SUPERMARKET'), [])
  const tiles = useMemo(() => tileFloor([3, 3]), [])
  const signMaterial = useRef<THREE.MeshStandardMaterial>(null)
  useNightMaterial(signMaterial, '#ffffff', '#ffffff', 0, 0.6)
  return <group>
    <Floor position={[23, 0.005, -0.5]} size={[10, 9.4]} map={tiles} roughness={0.4}/>
    {/* Walls: full at the back and sides, glass storefront with an entrance in the middle */}
    <Wall from={[18, -5.2]} to={[28, -5.2]}/>
    <Wall from={[18, -5.2]} to={[18, 4.2]}/>
    <Wall from={[28, -5.2]} to={[28, 4.2]}/>
    <Wall from={[18, 4.2]} to={[21.5, 4.2]} height={0.55}/>
    <Wall from={[24.5, 4.2]} to={[28, 4.2]} height={0.55}/>
    <GlassZ z={4.2} fromX={18} toX={21.5} bottom={0.55} top={2.3}/>
    <GlassZ z={4.2} fromX={24.5} toX={28} bottom={0.55} top={2.3}/>
    <GlassZ z={4.2} fromX={21.5} toX={24.5} bottom={2.3} top={2.6}/>
    <RBox position={[23, 2.68, -0.5]} size={[10.4, 0.16, 9.8]} radius={0.02} color="#9a9a94" roughness={0.95}/>
    {/* Pylon sign above the roof, backlit in the evening */}
    <RBox position={[20.8, 3.1, 4.25]} size={[0.12, 0.9, 0.12]} radius={0.02} color="#2f3336"/>
    <RBox position={[25.2, 3.1, 4.25]} size={[0.12, 0.9, 0.12]} radius={0.02} color="#2f3336"/>
    <RBox position={[23, 3.95, 4.25]} size={[5.6, 1.7, 0.12]} radius={0.03} color="#1b7a4d"/>
    <mesh position={[23, 3.95, 4.32]}><planeGeometry args={[5.4, 1.68]}/><meshStandardMaterial ref={signMaterial} map={sign} roughness={0.7} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0}/></mesh>
    <mesh position={[23, 3.95, 4.18]} rotation={[0, Math.PI, 0]}><planeGeometry args={[5.4, 1.68]}/><meshStandardMaterial map={sign} roughness={0.7}/></mesh>
    {/* Green awning over the storefront */}
    <RBox position={[23, 2.42, 4.95]} size={[9.6, 0.06, 1.5]} radius={0.02} rotation={[-0.35, 0, 0]} color="#1b7a4d"/>
    {/* Shelves with goods, chillers at the back, checkout by the door */}
    <MarketShelf position={[20.3, 0, -2.6]}/>
    <MarketShelf position={[23, 0, -2.6]}/>
    <MarketShelf position={[25.7, 0, -2.6]}/>
    <MarketShelf position={[20.3, 0, 0.4]}/>
    <MarketShelf position={[25.7, 0, 0.4]}/>
    <Fridge position={[19, 0, -4.7]}/>
    <Fridge position={[20.1, 0, -4.7]}/>
    <RBox position={[23, 0.45, 3.3]} size={[1.8, 0.9, 0.6]} radius={0.02} color="#f2eee6"/>
    <RBox position={[23, 1.05, 3.3]} size={[0.4, 0.3, 0.3]} radius={0.02} color="#2a2f33"/>
  </group>
}

/** Standing sign by the office entrance: the building is I.S.A & Richkeyrick Office. */
function BuildingSign() {
  const sign = useMemo(() => signTextureFit('I.S.A & RICHKEYRICK', '#16283d', '#d8b36a', 'OFFICE'), [])
  const front = useRef<THREE.MeshStandardMaterial>(null)
  const back = useRef<THREE.MeshStandardMaterial>(null)
  useNightMaterial(front, '#ffffff', '#ffffff', 0, 0.55)
  useNightMaterial(back, '#ffffff', '#ffffff', 0, 0.55)
  return <group position={[3.4, 0, 5.1]}>
    <RBox position={[-0.8, 0.75, 0]} size={[0.08, 1.5, 0.08]} radius={0.02} color="#2f3336"/>
    <RBox position={[0.8, 0.75, 0]} size={[0.08, 1.5, 0.08]} radius={0.02} color="#2f3336"/>
    <RBox position={[0, 1.55, 0]} size={[2.3, 0.85, 0.08]} radius={0.03} color="#16283d"/>
    <mesh position={[0, 1.55, 0.045]}><planeGeometry args={[2.2, 0.69]}/><meshStandardMaterial ref={front} map={sign} roughness={0.7} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0}/></mesh>
    <mesh position={[0, 1.55, -0.045]} rotation={[0, Math.PI, 0]}><planeGeometry args={[2.2, 0.69]}/><meshStandardMaterial ref={back} map={sign} roughness={0.7} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0}/></mesh>
  </group>
}

/** Green street sign on a pole at the corner by Ricky Market: Jalan ISA. */
function StreetSign() {
  const sign = useMemo(() => signTexture('JALAN ISA', '#1b5e20', '#ffffff'), [])
  return <group position={[17.3, 0, 9.0]}>
    <Cyl position={[0, 1.1, 0]} radius={0.05} height={2.2} color="#2f3336" metalness={0.5}/>
    <RBox position={[0, 2.15, 0]} size={[1.3, 0.42, 0.05]} radius={0.02} color="#1b5e20"/>
    <mesh position={[0, 2.15, 0.03]}><planeGeometry args={[1.2, 0.375]}/><meshStandardMaterial map={sign} roughness={0.7}/></mesh>
    <mesh position={[0, 2.15, -0.03]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.2, 0.375]}/><meshStandardMaterial map={sign} roughness={0.7}/></mesh>
  </group>
}

function Outdoors({ layout, registerAnchor }: { layout: OfficeLayout; registerAnchor?: (key: string) => (object: THREE.Object3D | null) => void }) {
  // How far the building grew to the left for a larger crew; the grounds grow with it.
  const shift = layout.building.minX + 9.5
  const lawn = useMemo(() => grass([14, 12]), [])
  const road = useMemo(() => asphalt([8, 1]), [])
  const sidewalk = useMemo(() => pavingStones([14, 2]), [])
  const gang = useMemo(() => pavingStones([2, 5]), [])
  return <group>
    <Floor position={[shift / 2, -0.02, 2]} size={[60 - shift, 44]} map={lawn} roughness={1}/>
    <Floor position={[shift / 2, -0.005, 7.1]} size={[34 - shift, 5]} map={sidewalk} roughness={0.9}/>
    <Floor position={[shift / 2, -0.01, 12.1]} size={[60 - shift, 5]} map={road} roughness={0.95}/>
    {/* Path from the entrance to the sidewalk */}
    <Floor position={[5.8, 0, 4.7]} size={[1.8, 1]} map={sidewalk}/>
    {/* Merah Putih by the entrance */}
    <FlagPole position={FLAG}/>
    {/* Ricky Market next door, the Gedung ISA sign by the entrance, Jalan ISA street sign */}
    <RickyMarket/>
    <BuildingSign/>
    <StreetSign/>
    {/* Sidewalk continues in front of Ricky Market (edge to edge with the office sidewalk) */}
    <Floor position={[22.75, -0.005, 7.1]} size={[11.5, 5]} map={sidewalk} roughness={0.9}/>
    {/* The gang (alley) left of the building, with the street food out of the main view */}
    <Floor position={[layout.gangCenterX, -0.008, -0.4]} size={[3.6, 10]} map={gang} roughness={0.9}/>
    <group position={layout.baksoCart} rotation={[0, STALL_ROTATION, 0]}>
      <Gerobak position={[0, 0, 0]}/>
      <Vendor position={[-1.6, 0, 0]} rotation={Math.PI / 2} shirt="#f1f1ec" hat="peci"/>
      <object3D ref={registerAnchor?.('street-bakso')} position={[-1.6, 2.0, 0]}/>
    </group>
    <group position={layout.kopiBike} rotation={[0, STALL_ROTATION, 0]}>
      <KopiSepeda position={[0, 0, 0]}/>
      <Vendor position={[-1.35, 0, -0.1]} rotation={Math.PI / 2} shirt="#2f6d8f" hat="cap"/>
      <object3D ref={registerAnchor?.('street-kopi')} position={[-1.35, 2.0, -0.1]}/>
    </group>
    {/* Street-life hangout in front of the office: cilok, nasi goreng and ayam penyet carts
       along the sidewalk, a busker, a beggar, and the satpam with his post by the entrance. */}
    <group position={layout.cilokCart} rotation={[0, Math.PI, 0]}>
      <FoodCart position={[0, 0, 0]} title="CILOK" subtitle="KENYAL · PEDAS" accent="#6a1b9a" top="steamer"/>
      <Vendor position={[-1.6, 0, 0]} rotation={Math.PI / 2} shirt="#7b1fa2" hat="peci"/>
      <object3D ref={registerAnchor?.('street-cilok')} position={[-1.6, 2.0, 0]}/>
    </group>
    <group position={layout.nasgorCart} rotation={[0, Math.PI, 0]}>
      <FoodCart position={[0, 0, 0]} title="NASI GORENG" subtitle="WOK · PANAS" accent="#e65100" top="wok"/>
      <Vendor position={[-1.6, 0, 0]} rotation={Math.PI / 2} shirt="#f57c00" hat="cap"/>
      <object3D ref={registerAnchor?.('street-nasgor')} position={[-1.6, 2.0, 0]}/>
    </group>
    <group position={layout.penyetCart} rotation={[0, Math.PI, 0]}>
      <FoodCart position={[0, 0, 0]} title="AYAM PENYET" subtitle="SAMBAL · NASI" accent="#c62828" top="grill"/>
      <Vendor position={[-1.6, 0, 0]} rotation={Math.PI / 2} shirt="#ef5350" hat="peci"/>
      <object3D ref={registerAnchor?.('street-penyet')} position={[-1.6, 2.0, 0]}/>
    </group>
    <Pengamen position={[11.8, 0, 6.2]} rotation={Math.PI}/>
    <object3D ref={registerAnchor?.('street-pengamen')} position={[11.8, 1.95, 6.2]}/>
    <Pengemis position={[15.8, 0, 8.6]} rotation={Math.PI}/>
    <object3D ref={registerAnchor?.('street-pengemis')} position={[15.8, 1.7, 8.6]}/>
    <GuardPost position={[7.8, 0, 4.9]}/>
    <Satpam position={[6.9, 0, 5.2]}/>
    <object3D ref={registerAnchor?.('street-satpam')} position={[6.9, 2.0, 5.2]}/>
    {/* AC outdoor units behind the building */}
    <AcOutdoorUnit position={[-5.3, 0, layout.building.minZ - 0.45]} rotation={Math.PI}/>
    <AcOutdoorUnit position={[TV[0] - 1.6, 0, layout.building.minZ - 0.45]} rotation={Math.PI}/>
    <StreetLamp position={[-8, 0, 9.3]}/>
    <StreetLamp position={[4, 0, 9.3]}/>
    {[[-12.8 + shift, -7.4, 1.3], [13.5, -7.2, 1.2], [-14.8 + shift, 2.6, 1.1], [18.6, 4.8, 1.3], [-10.5 + shift, 7.5, 1], [12, 8, 1.1], [-2, -8.5, 1.2], [6, -8, 1.1]].map(([x, z, size]) => <Tree key={`${x}${z}`} position={[x, 0, z]} size={size}/>)}
  </group>
}

/** The grounds plus the floor in view: lantai 1 as a cut-away, or lantai 2 on top of the closed building. */
export function Environment({ layout, floor = 1, registerAnchor }: { layout: OfficeLayout; floor?: FloorNumber; registerAnchor?: (key: string) => (object: THREE.Object3D | null) => void }) {
  return <group>
    {floor === 1 ? <Building layout={layout}/> : <><BuildingShell layout={layout}/><UpperFloor layout={layout}/></>}
    <Outdoors layout={layout} registerAnchor={registerAnchor}/>
  </group>
}
