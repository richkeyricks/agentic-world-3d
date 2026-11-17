// Mission Control ISA — ledger data source for this Ruang fork.
//
// Reads the ISA ledger (tasks.jsonl / queue.jsonl / dispatch.json) and the cron
// schedules from the workspace, and shapes them into the snapshots the Ruang
// UI already renders. No `hermes` CLI is needed. Everything stays read-only:
// this module never writes to the ledger.
//
// Mode: ledger is used when RUANG_DATA_SOURCE=ledger, or ISA_LEDGER_DIR is set,
// or the default ISA ledger exists on this machine. Otherwise the original
// Hermes collectors in mission-control.ts are used unchanged.

import { existsSync, readFileSync, readdirSync, type Dirent } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, relative, sep } from 'node:path'
import {
  buildDashboard,
  buildOfficeSnapshot,
  type ActivitySnapshot,
  type AgentActivitySnapshot,
  type CalendarSnapshot,
  type ChannelSnapshot,
  type DashboardSnapshot,
  type ExplicitOfficeState,
  type KnowledgeSnapshot,
  type LogsSnapshot,
  type OfficeSnapshot,
  type RuntimeSnapshot,
  type ScheduledJob,
  type Session,
  type Task,
  type TaskBoardSnapshot,
  type TaskDetailSnapshot,
  type UsageSnapshot,
} from './mission-control.js'

/** The 7 ISA agents (SOP ISA v1.0 roster). */
export const ISA_ROSTER = [
  { id: 'isa', name: 'ISA', role: 'Chief Orchestrator', color: '#D8B36A' },
  { id: 'richkeyrick', name: 'Richkeyrick AI', role: 'Architect & Lead Engineer', color: '#7DD3FC' },
  { id: 'neo', name: 'NEO AI', role: 'Router / Intake', color: '#60A5FA' },
  { id: 'createme', name: 'Createme AI', role: 'Creative Director', color: '#F472B6' },
  { id: 'itc', name: 'ITC AI', role: 'Research, Evidence & Executor', color: '#34D399' },
  { id: 'skynet', name: 'SkyNET AI', role: 'Verifier, Adversarial & Security', color: '#F87171' },
  { id: 'jarvis', name: 'JARVIS AI', role: 'Memory & Delivery', color: '#E5E7EB' },
] as const

export function ledgerDir(): string {
  return process.env.ISA_LEDGER_DIR ?? join(homedir(), 'workspace', 'mission-control-isa', 'data')
}

export function workspaceRoot(): string {
  return process.env.ISA_WORKSPACE_DIR ?? join(homedir(), 'workspace')
}

export function isLedgerMode(): boolean {
  if (process.env.RUANG_DATA_SOURCE === 'hermes') return false
  if (process.env.RUANG_DATA_SOURCE === 'ledger') return true
  if (process.env.ISA_LEDGER_DIR) return true
  return existsSync(join(ledgerDir(), 'tasks.jsonl'))
}

// ---------------------------------------------------------------------------
// Ledger readers (same tolerant parsing as the original ISA server: a broken
// line is skipped, a missing file reads as empty — never a crash).

interface LedgerEvent {
  ts?: string
  task_id?: string
  agent?: string
  title?: string
  status?: string
  detail?: string
  subagent?: string | null
  /** Estimated duration of the task, in minutes. An estimate only — never a measurement. */
  estimated_minutes?: number
}

/** Progress of one task run: the % of its estimated time that has elapsed. */
export interface TaskProgress {
  percent: number
  estimatedMinutes: number
  elapsedMinutes: number
}

const TERMINAL_STATUSES = new Set(['done', 'cancelled', 'failed'])
const ACTIVE_STATUSES = new Set(['started', 'progress'])

function validEstimate(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function parseTs(value: string | undefined): number | undefined {
  if (!value) return undefined
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : undefined
}

/** First parseable ts among events with one of the given statuses (or any status when the list is empty). */
function firstTs(events: LedgerEvent[], statuses: Set<string>): number | undefined {
  for (const event of events) {
    if (statuses.size > 0 && (!event.status || !statuses.has(event.status))) continue
    const ms = parseTs(event.ts)
    if (ms !== undefined) return ms
  }
  return undefined
}

/**
 * Progress of one (task_id, agent) event run, in file order.
 *
 * - The estimate is the latest valid `estimated_minutes` among the events;
 *   without one there is no progress — never invent it.
 * - Start is the earliest started/progress ts of the current run (the events
 *   after the latest terminal event before the last one); a task re-opened
 *   after being done restarts from its new start. For a done task with no
 *   started/progress event, the run's first event is the start.
 * - Active: percent = elapsed / estimate, rounded, capped at 99 — a task is
 *   only 100% when it is actually done.
 * - Done: exactly 100 (elapsed = done ts - start).
 * - Any other latest status (queued/created/review/blocked/failed/cancelled):
 *   undefined — the task is not being worked on.
 */
export function taskProgress(events: LedgerEvent[], now: number): TaskProgress | undefined {
  if (events.length === 0) return undefined
  let estimate: number | undefined
  for (const event of events) {
    const value = validEstimate(event.estimated_minutes)
    if (value !== undefined) estimate = value
  }
  if (estimate === undefined) return undefined
  const last = events[events.length - 1]
  let runStart = 0
  for (let i = events.length - 2; i >= 0; i--) {
    if (events[i].status && TERMINAL_STATUSES.has(events[i].status!)) { runStart = i + 1; break }
  }
  const run = events.slice(runStart)
  const startTs = firstTs(run, ACTIVE_STATUSES) ?? firstTs(run, new Set())
  if (startTs === undefined) return undefined
  if (last.status === 'done') {
    const doneTs = parseTs(last.ts)
    if (doneTs === undefined) return undefined
    return { percent: 100, estimatedMinutes: estimate, elapsedMinutes: Math.max(0, Math.floor((doneTs - startTs) / 60000)) }
  }
  if (last.status && ACTIVE_STATUSES.has(last.status)) {
    const elapsedMs = Math.max(0, now - startTs)
    return {
      percent: Math.min(99, Math.round((elapsedMs / (estimate * 60000)) * 100)),
      estimatedMinutes: estimate,
      elapsedMinutes: Math.floor(elapsedMs / 60000),
    }
  }
  return undefined
}

/**
 * Snapshot-level progress for one agent: the progress of their currently
 * active task (per-task latest event is started/progress), preferring the
 * most recently updated one. A queued/done task never contributes — an agent
 * with no active task shows no bar, even if a queued event for another task
 * was appended after their running task.
 */
export function agentProgress(events: LedgerEvent[], agentId: string, now: number): TaskProgress | undefined {
  const byTask = new Map<string, LedgerEvent[]>()
  for (const event of events) {
    if (event.agent !== agentId || !event.task_id) continue
    const list = byTask.get(event.task_id) ?? []
    list.push(event)
    byTask.set(event.task_id, list)
  }
  let best: { ts: number; progress: TaskProgress } | undefined
  for (const taskEvents of byTask.values()) {
    const last = taskEvents[taskEvents.length - 1]
    if (!last.status || !ACTIVE_STATUSES.has(last.status)) continue
    const progress = taskProgress(taskEvents, now)
    if (!progress) continue
    const ts = parseTs(last.ts) ?? 0
    if (!best || ts >= best.ts) best = { ts, progress }
  }
  return best?.progress
}

interface QueueEntry {
  ts?: string
  prompt?: string
  agent?: string
  status?: string
}

function readJsonLines<T>(file: string): T[] {
  try {
    const raw = readFileSync(file, 'utf8')
    if (!raw.trim()) return []
    const out: T[] = []
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        out.push(JSON.parse(trimmed) as T)
      } catch {
        // Broken line: skip, never crash.
      }
    }
    return out
  } catch {
    return []
  }
}

function readTasks(): LedgerEvent[] {
  return readJsonLines<LedgerEvent>(join(ledgerDir(), 'tasks.jsonl'))
}

function readQueue(): QueueEntry[] {
  return readJsonLines<QueueEntry>(join(ledgerDir(), 'queue.jsonl'))
}

function readDispatchPaused(): boolean {
  try {
    const parsed = JSON.parse(readFileSync(join(ledgerDir(), 'dispatch.json'), 'utf8')) as { paused?: boolean }
    return parsed?.paused === true
  } catch {
    return false
  }
}

type AgentWorkState = 'idle' | 'working' | 'paused'

interface AgentState {
  id: string
  name: string
  role: string
  color: string
  status: AgentWorkState
  active?: LedgerEvent
  last?: LedgerEvent
}

function agentStates(events: LedgerEvent[], paused: boolean): AgentState[] {
  return ISA_ROSTER.map((agent) => {
    const mine = events.filter((event) => event.agent === agent.id)
    const last = mine.length > 0 ? mine[mine.length - 1] : undefined
    // Per-task latest: an agent is working if ANY of their tasks is running.
    // (The old rule — the agent's single latest event — flipped an agent to
    // idle when a queued event for another task was appended after their
    // running task, e.g. an estimate added to a queued follow-up task.)
    const byTask = new Map<string, LedgerEvent>()
    for (const event of mine) {
      if (event.task_id) byTask.set(event.task_id, event)
    }
    const running = [...byTask.values()].filter((event) => event.status !== undefined && ACTIVE_STATUSES.has(event.status))
    let status: AgentWorkState = 'idle'
    let active: LedgerEvent | undefined
    if (paused) {
      status = 'paused'
    } else if (running.length > 0) {
      status = 'working'
      active = running.reduce((a, b) => {
        const ta = parseTs(a.ts) ?? 0
        const tb = parseTs(b.ts) ?? 0
        return tb >= ta ? b : a
      })
    }
    return { ...agent, status, active, last }
  })
}

/** Ledger event status -> board column (the board only knows these words). */
const BOARD_STATUS: Record<string, string> = {
  started: 'running',
  progress: 'running',
  done: 'done',
  failed: 'blocked',
  queued: 'todo',
  created: 'triage',
  review: 'review',
  blocked: 'blocked',
  waiting_approval: 'review',
  cancelled: 'archived',
  escalated: 'blocked',
}

function boardStatus(status: string | undefined): string {
  return BOARD_STATUS[status ?? ''] ?? 'todo'
}

// ---------------------------------------------------------------------------
// Collectors: same shapes as the Hermes collectors in mission-control.ts.

export async function collectLedgerRuntime(): Promise<RuntimeSnapshot> {
  return {
    profiles: {
      availability: 'available',
      data: ISA_ROSTER.map((agent) => ({ name: agent.id, model: 'Muse Spark', gateway: 'Unknown' as const })),
    },
    openCode: { availability: 'unavailable', data: 'Unknown' },
    fetchedAt: new Date().toISOString(),
  }
}

export async function collectLedgerTaskBoard(): Promise<TaskBoardSnapshot> {
  const events = readTasks()
  const byId = new Map<string, LedgerEvent>()
  for (const event of events) {
    if (event.task_id) byId.set(event.task_id, event)
  }
  const tasks: Task[] = [...byId.values()].map((event) => ({
    id: event.task_id!,
    title: event.title ?? event.task_id!,
    status: boardStatus(event.status),
    assignee: event.agent,
    board: 'isa',
  }))
  // Quick tasks waiting in the queue are open work too.
  readQueue().forEach((entry, index) => {
    const epoch = entry.ts ? Date.parse(entry.ts) : Number.NaN
    tasks.push({
      id: Number.isFinite(epoch) ? `q${epoch}` : `q${index}`,
      title: entry.prompt ?? 'Quick task',
      status: 'todo',
      assignee: entry.agent,
      board: 'isa',
    })
  })
  return {
    tasks: { availability: 'available', data: tasks },
    boards: [{ slug: 'isa', name: 'ISA', current: true, total: tasks.length }],
    fetchedAt: new Date().toISOString(),
  }
}

export async function collectLedgerActivity(): Promise<ActivitySnapshot> {
  const events = readTasks()
  const states = agentStates(events, readDispatchPaused())
  const activeByAgent = new Map(states.filter((state) => state.status === 'working' && state.active).map((state) => [state.id, state.active!.task_id]))
  const sessions: Session[] = events.slice(-20).reverse().map((event) => ({
    title: event.title ?? event.task_id ?? 'Ledger event',
    preview: event.title ?? event.task_id ?? '',
    lastActive: event.ts ?? new Date().toISOString(),
    id: event.task_id,
    actor: event.agent,
    active: event.agent !== undefined && activeByAgent.get(event.agent) === event.task_id,
  }))
  return { sessions: { availability: 'available', data: sessions }, fetchedAt: new Date().toISOString() }
}

export async function collectLedgerAgentActivity(): Promise<AgentActivitySnapshot> {
  const events = readTasks()
  const states = agentStates(events, readDispatchPaused())
  return {
    agents: states.map((state) => ({
      profile: state.id,
      availability: 'available' as const,
      active: state.status === 'working',
      ...(state.status === 'working' ? { kind: 'tools' as const } : {}),
      ...(state.active?.title ? { label: state.active.title } : {}),
      ...(state.last?.ts ? { lastSeen: state.last.ts } : {}),
      mentionsOpenCode: false,
    })),
    fetchedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Schedules: the cron .md files with YAML frontmatter (ported from the
// original ISA server, same tolerant parsing).

function walkMdFiles(dir: string, out: string[]): void {
  let entries: Dirent[] = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '_archive' || entry.name === '_invalid') continue
      walkMdFiles(full, out)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full)
    }
  }
}

interface YamlRecord { [key: string]: YamlValue }
type YamlValue = string | number | boolean | string[] | YamlRecord

function parseSimpleYaml(text: string): Record<string, YamlValue> {
  const obj: Record<string, YamlValue> = {}
  let parent: string | null = null
  for (const rawLine of text.split('\n')) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue
    const indent = rawLine.match(/^(\s*)/)?.[1].length ?? 0
    const line = rawLine.trim()
    const match = line.match(/^([^:]+):\s*(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    let value = match[2].trim()
    if (value === '') {
      parent = key
      obj[key] = (obj[key] && typeof obj[key] === 'object' ? obj[key] : {}) as Record<string, YamlValue>
      continue
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    let parsed: YamlValue = value
    if (value === 'true') parsed = true
    else if (value === 'false') parsed = false
    else if (value === '[]') parsed = []
    else if (/^-?\d+$/.test(value)) parsed = parseInt(value, 10)
    if (indent >= 2 && parent && typeof obj[parent] === 'object') (obj[parent] as Record<string, YamlValue>)[key] = parsed
    else {
      obj[key] = parsed
      parent = null
    }
  }
  return obj
}

function parseEveryToMs(value: string | undefined): number | null {
  if (!value || typeof value !== 'string') return null
  const match = value.trim().match(/^(\d+)\s*(s|m|h|d)$/)
  if (!match) return null
  const unit: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
  return parseInt(match[1], 10) * unit[match[2]]
}

function everyLabel(value: string | undefined): string {
  if (!value) return 'interval'
  const match = String(value).trim().match(/^(\d+)\s*(s|m|h|d)$/)
  if (!match) return `tiap ${value}`
  const word: Record<string, string> = { s: 'detik', m: 'menit', h: 'jam', d: 'hari' }
  return `tiap ${match[1]} ${word[match[2]]}`
}

function formatWibShort(isoOrDate: string | Date): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(isoOrDate))
  } catch {
    return String(isoOrDate)
  }
}

function nextDailyIso(timeStr: string, tz: string | undefined): string | null {
  try {
    const parts = String(timeStr).split(':')
    const hh = parseInt(parts[0], 10)
    const mm = parseInt(parts[1] ?? '0', 10)
    const ss = parseInt(parts[2] ?? '0', 10)
    const now = new Date()
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz ?? 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23',
    })
    const fmtParts = fmt.formatToParts(now)
    const get = (type: string): string => fmtParts.find((part) => part.type === type)?.value ?? '0'
    const y = parseInt(get('year'), 10)
    const mo = parseInt(get('month'), 10)
    const d = parseInt(get('day'), 10)
    const offset = tz === 'Asia/Jakarta' || !tz ? '+07:00' : '+00:00'
    const pad = (n: number): string => String(n).padStart(2, '0')
    let candidate = new Date(`${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}${offset}`)
    if (candidate.getTime() <= now.getTime()) candidate = new Date(candidate.getTime() + 86400000)
    return candidate.toISOString()
  } catch {
    return null
  }
}

interface ScheduleItem {
  id: string
  title: string
  enabled: boolean
  owner: string | null
  kind: string
  label: string
  timezone: string
  next_iso: string | null
  is_system: boolean
  source: string
}

function scheduleToItem(file: string, fm: Record<string, YamlValue>, body: string): ScheduleItem {
  const root = workspaceRoot()
  const rel = relative(root, file)
  const id = typeof fm.id === 'string' ? fm.id : basename(file, '.md')
  let title = typeof fm.title === 'string' ? fm.title : ''
  if (!title) {
    const first = (body || '').split('\n').map((line) => line.trim()).find((line) => line.length > 0) || ''
    title = first ? first.slice(0, 100) : id
  }
  const sched = (fm.schedule && typeof fm.schedule === 'object' ? fm.schedule : {}) as Record<string, YamlValue>
  let kind = typeof sched.kind === 'string' ? sched.kind : ''
  if (!kind) {
    if (rel.includes('/daily/')) kind = 'daily'
    else if (rel.includes('/minutely/') || rel.includes('/hourly/')) kind = 'interval'
    else if (rel.includes('/runonce/')) kind = 'runonce'
    else if (rel.includes('/weekly/')) kind = 'weekly'
    else if (rel.includes('/monthly/')) kind = 'monthly'
    else kind = 'unknown'
  }
  const tz = typeof sched.timezone === 'string' ? sched.timezone : 'Asia/Jakarta'
  const enabled = fm.enabled !== false
  let owner: string | null = typeof fm.owner === 'string' ? fm.owner : null
  if (!owner && rel.startsWith('goals/')) {
    const parts = rel.split(sep)
    owner = parts.length >= 2 ? `goal:${parts[1]}` : null
  }
  const metadata = fm.metadata && typeof fm.metadata === 'object' ? fm.metadata as Record<string, YamlValue> : null
  const createdBy = metadata && typeof metadata.created_by === 'string' ? metadata.created_by : null
  if (!owner && createdBy) owner = createdBy
  const isSystem = createdBy === 'system' || owner === 'system' || fm.mode === 'heartbeat'

  let label = ''
  let nextIso: string | null = null
  if (kind === 'runonce') {
    const at = typeof sched.at === 'string' ? sched.at : ''
    if (at) {
      const date = new Date(at.length === 19 ? at + (tz === 'Asia/Jakarta' ? '+07:00' : 'Z') : at)
      nextIso = Number.isFinite(date.getTime()) ? date.toISOString() : null
      label = `sekali • ${formatWibShort(date)}`
    } else {
      label = 'sekali'
    }
  } else if (kind === 'interval') {
    const every = typeof sched.every === 'string' ? sched.every : ''
    label = everyLabel(every)
    const ms = parseEveryToMs(every)
    nextIso = ms ? new Date(Date.now() + ms).toISOString() : null
  } else if (kind === 'daily' || kind === 'weekly' || kind === 'monthly') {
    const time = typeof sched.time === 'string' ? sched.time : typeof sched.at === 'string' ? sched.at : ''
    label = kind === 'daily' ? (time ? `harian • ${time.slice(0, 5)}` : 'harian') : `${kind === 'weekly' ? 'mingguan' : 'bulanan'}${time ? ` • ${time.slice(0, 5)}` : ''}`
    nextIso = time ? nextDailyIso(time, tz) : null
  } else {
    label = kind
  }

  return {
    id: String(id), title: String(title), enabled: Boolean(enabled),
    owner: owner ? String(owner) : null, kind, label, timezone: tz,
    next_iso: nextIso, is_system: Boolean(isSystem), source: rel,
  }
}

function getLedgerSchedules(): ScheduleItem[] {
  const root = workspaceRoot()
  const files: string[] = []
  walkMdFiles(join(root, 'cron.d'), files)
  try {
    for (const goal of readdirSync(join(root, 'goals'), { withFileTypes: true })) {
      if (!goal.isDirectory()) continue
      walkMdFiles(join(root, 'goals', goal.name, 'crons'), files)
    }
  } catch {
    // No goals directory: ignore.
  }
  const out: ScheduleItem[] = []
  for (const file of files.sort()) {
    try {
      const content = readFileSync(file, 'utf8')
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
      if (!match) continue // Broken file or no frontmatter: skip, never crash.
      const fm = parseSimpleYaml(match[1])
      if (!fm || typeof fm !== 'object') continue
      out.push(scheduleToItem(file, fm, match[2] || ''))
    } catch {
      continue
    }
  }
  return out
}

export async function collectLedgerCalendar(): Promise<CalendarSnapshot> {
  const jobs: ScheduledJob[] = getLedgerSchedules().map((item) => ({
    name: item.title,
    schedule: item.label,
    id: item.id,
    ...(item.next_iso ? { nextRun: item.next_iso } : {}),
    status: item.enabled ? 'active' : 'paused',
    agent: 'isa',
  }))
  return { jobs: { availability: 'available', data: jobs }, fetchedAt: new Date().toISOString() }
}

// ---------------------------------------------------------------------------

export async function collectLedgerLogs(): Promise<LogsSnapshot> {
  const lines = readTasks().slice(-200).map((event) => ({
    text: `${event.ts ?? ''}  [${event.agent ?? '?'}]  ${event.status ?? ''}  ${event.title ?? event.task_id ?? ''}`,
    level: (event.status === 'failed' ? 'ERROR' : 'INFO') as 'ERROR' | 'INFO',
  }))
  return {
    files: [{ name: 'ledger', label: 'ISA ledger', source: { availability: 'available', data: lines } }],
    fetchedAt: new Date().toISOString(),
  }
}

export async function collectLedgerChannels(): Promise<ChannelSnapshot> {
  // WhatsApp Business (085260113313) was connected via WhatsApp Web; there is
  // no live gateway session held by this server, so it is Configured, not
  // Connected — the honest state for this machine right now.
  return {
    channels: { availability: 'available', data: [{ name: 'WhatsApp Business', status: 'Configured' }] },
    fetchedAt: new Date().toISOString(),
  }
}

export async function collectLedgerKnowledge(): Promise<KnowledgeSnapshot> {
  return { skills: { availability: 'unavailable', data: [] }, fetchedAt: new Date().toISOString() }
}

export async function collectLedgerUsage(days: number): Promise<UsageSnapshot> {
  return {
    days,
    agents: ISA_ROSTER.map((agent) => ({ agent: agent.id, availability: 'unavailable' as const, error: 'Token usage is not connected to a real source yet.' })),
    totals: { sessions: 0, messages: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    models: [],
    sources: [],
    tools: [],
    fetchedAt: new Date().toISOString(),
  }
}

export async function getLedgerTaskDetail(id: string, _board?: string): Promise<TaskDetailSnapshot | undefined> {
  const events = readTasks()
  if (id.startsWith('q')) {
    const epoch = Number(id.slice(1))
    const entry = readQueue().find((item) => item.ts !== undefined && Date.parse(item.ts) === epoch)
    if (!entry) return undefined
    return {
      task: {
        availability: 'available',
        data: {
          id, title: entry.prompt ?? 'Quick task', status: 'todo', assignee: entry.agent,
          skills: [], parents: [], children: [], comments: [],
          events: [{ kind: 'queued', detail: entry.prompt, createdAt: entry.ts }],
          runs: [],
        },
      },
      fetchedAt: new Date().toISOString(),
    }
  }
  const mine = events.filter((event) => event.task_id === id)
  if (mine.length === 0) return undefined
  const last = mine[mine.length - 1]
  return {
    task: {
      availability: 'available',
      data: {
        id,
        title: last.title ?? id,
        status: boardStatus(last.status),
        assignee: last.agent,
        skills: [],
        parents: [],
        children: [],
        comments: [],
        events: mine.map((event) => ({ kind: event.status ?? '', detail: event.detail ?? event.title, createdAt: event.ts })),
        runs: mine.map((event) => ({
          id: `${event.ts ?? ''}-${event.status ?? ''}`,
          profile: event.agent,
          status: event.status,
          outcome: event.status,
          summary: event.title,
          startedAt: event.ts,
          endedAt: event.ts,
        })),
      },
    },
    fetchedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Office + dashboard, composed with the shared builder so the states, rooms
// and provenance rules stay identical to the Hermes path.

/** Agents sharing one active task are in a meeting together. */
export function ledgerMeetingStates(now = Date.now()): ExplicitOfficeState[] {
  const events = readTasks()
  if (readDispatchPaused()) return []
  const states = agentStates(events, false)
  const groups = new Map<string, string[]>()
  for (const state of states) {
    if (state.status === 'working' && state.active?.task_id) {
      const list = groups.get(state.active.task_id) ?? []
      list.push(state.id)
      groups.set(state.active.task_id, list)
    }
  }
  const out: ExplicitOfficeState[] = []
  for (const ids of groups.values()) {
    if (ids.length < 2) continue
    for (const id of ids) out.push({ station: id, state: 'Collaborating', expiresAt: new Date(now + 30_000).toISOString() })
  }
  return out
}

export async function getLedgerOffice(now = Date.now()): Promise<OfficeSnapshot> {
  const [runtime, board, activity, agentActivity] = await Promise.all([
    collectLedgerRuntime(),
    collectLedgerTaskBoard(),
    collectLedgerActivity(),
    collectLedgerAgentActivity(),
  ])
  const events = readTasks()
  const snapshot = buildOfficeSnapshot(runtime, board, activity, { agentActivity, explicitStates: ledgerMeetingStates(now), now })
  const byId = new Map<string, (typeof ISA_ROSTER)[number]>(ISA_ROSTER.map((agent) => [agent.id, agent]))
  snapshot.stations = snapshot.stations.map((station) => {
    const agent = byId.get(station.id)
    const progress = agentProgress(events, station.id, now)
    return {
      ...station,
      name: agent?.name ?? station.name,
      role: agent?.role ?? station.role,
      activity: station.activity.replace(/^Kanban: /, ''),
      // Progress is a number only — it never carries a task title, so it is
      // safe to show in the public view exactly as in admin.
      ...(progress ? { progressPercent: progress.percent, estimatedMinutes: progress.estimatedMinutes, elapsedMinutes: progress.elapsedMinutes } : {}),
      provenance: station.provenance
        .replace('Gateway Unknown (hermes profile list)', 'ISA ledger (tasks.jsonl)')
        .replace('Kanban:', 'Tugas:')
        .replace(/; live activity \(hermes -p \S+ logs\/sessions, last 3m\): /, '; live activity (ISA ledger, last 3m): ')
        .replace('Ruang managed-idle placement policy', 'ISA managed-idle placement policy'),
    }
  })
  return snapshot
}

export async function getLedgerDashboard(now = Date.now()): Promise<DashboardSnapshot> {
  const [runtime, board, calendar, activity, knowledge, channels, office] = await Promise.all([
    collectLedgerRuntime(),
    collectLedgerTaskBoard(),
    collectLedgerCalendar(),
    collectLedgerActivity(),
    collectLedgerKnowledge(),
    collectLedgerChannels(),
    getLedgerOffice(now),
  ])
  return buildDashboard({
    runtime, board, calendar, activity, knowledge, channels, office,
    // No CLI commands run in ledger mode, so there is nothing to audit here.
    commands: { total: 0, failed: 0, averageMs: 0 },
  })
}
