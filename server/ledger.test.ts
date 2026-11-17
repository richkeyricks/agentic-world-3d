// Ledger data source: the ISA ledger replaces the `hermes` CLI reads.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { agentProgress, collectLedgerActivity, collectLedgerRuntime, collectLedgerTaskBoard, getLedgerOffice, isLedgerMode, ledgerMeetingStates, taskProgress } from './ledger.js'

const events = [
  { ts: '2026-11-17T02:00:00+07:00', task_id: 'task-a', agent: 'isa', title: 'Adopsi Ruang', status: 'progress' },
  { ts: '2026-11-17T02:00:00+07:00', task_id: 'task-a', agent: 'richkeyrick', title: 'Adopsi Ruang', status: 'started' },
  { ts: '2026-11-17T01:00:00+07:00', task_id: 'task-b', agent: 'neo', title: 'Triage masuk', status: 'done' },
  { ts: '2026-11-17T00:00:00+07:00', task_id: 'task-c', agent: 'createme', title: 'Poster lama', status: 'failed' },
]

describe('ISA ledger source', () => {
  beforeAll(() => {
    const dir = mkdtempSync(join(tmpdir(), 'isa-ledger-'))
    writeFileSync(join(dir, 'tasks.jsonl'), events.map((event) => JSON.stringify(event)).join('\n') + '\n')
    writeFileSync(join(dir, 'queue.jsonl'), JSON.stringify({ ts: '2026-11-17T02:05:00+07:00', prompt: 'Cek harga', agent: 'itc', status: 'queued' }) + '\n')
    writeFileSync(join(dir, 'dispatch.json'), JSON.stringify({ paused: false }))
    process.env.ISA_LEDGER_DIR = dir
    process.env.RUANG_DATA_SOURCE = 'ledger'
  })
  afterAll(() => {
    delete process.env.ISA_LEDGER_DIR
    delete process.env.RUANG_DATA_SOURCE
  })

  it('uses the ledger when the directory is set', () => {
    expect(isLedgerMode()).toBe(true)
  })

  it('lists the 7 ISA agents', async () => {
    const runtime = await collectLedgerRuntime()
    expect(runtime.profiles.availability).toBe('available')
    expect(runtime.profiles.data.map((profile) => profile.name)).toEqual(['isa', 'richkeyrick', 'neo', 'createme', 'itc', 'skynet', 'jarvis'])
  })

  it('maps the latest event per task, plus the queue', async () => {
    const board = await collectLedgerTaskBoard()
    expect(board.tasks.availability).toBe('available')
    const byId = new Map(board.tasks.data.map((task) => [task.id, task]))
    expect(byId.get('task-a')).toMatchObject({ status: 'running', assignee: 'richkeyrick' })
    expect(byId.get('task-b')).toMatchObject({ status: 'done', assignee: 'neo' })
    expect(byId.get('task-c')).toMatchObject({ status: 'blocked', assignee: 'createme' })
    expect(board.tasks.data.some((task) => task.id?.startsWith('q') && task.title === 'Cek harga' && task.status === 'todo')).toBe(true)
  })

  it('marks agents sharing one active task as a meeting', () => {
    const states = ledgerMeetingStates(Date.now())
    expect(states.map((state) => state.station).sort()).toEqual(['isa', 'richkeyrick'])
    expect(states.every((state) => state.state === 'Collaborating')).toBe(true)
  })

  it('builds an office snapshot with ISA names and roles', async () => {
    const office = await getLedgerOffice()
    expect(office.stations).toHaveLength(7)
    const byId = new Map(office.stations.map((station) => [station.id, station]))
    expect(byId.get('isa')).toMatchObject({ name: 'ISA', role: 'Chief Orchestrator', state: 'Collaborating', roomPosition: 'meeting-area' })
    expect(byId.get('richkeyrick')).toMatchObject({ name: 'Richkeyrick AI', state: 'Collaborating' })
    expect(byId.get('neo')).toMatchObject({ name: 'NEO AI', state: 'Idle', room: 'Lounge' })
    expect(byId.get('createme')).toMatchObject({ state: 'Idle' })
    expect(office.summary.active).toBe(2)
    expect(office.summary.idle).toBe(5)
  })

  it('lists recent ledger events as activity', async () => {
    const activity = await collectLedgerActivity()
    expect(activity.sessions.availability).toBe('available')
    expect(activity.sessions.data).toHaveLength(4)
    expect(activity.sessions.data[0]).toMatchObject({ actor: 'createme', title: 'Poster lama' })
  })
})

describe('task progress % (estimated_minutes)', () => {
  const now = Date.parse('2026-11-17T09:00:00+07:00')
  const at = (minutes: number) => new Date(now - minutes * 60000).toISOString()

  it('computes elapsed / estimate for an active task', () => {
    expect(taskProgress([
      { ts: at(30), task_id: 't', agent: 'isa', status: 'progress', estimated_minutes: 60 },
    ], now)).toEqual({ percent: 50, estimatedMinutes: 60, elapsedMinutes: 30 })
  })

  it('caps at 99 while the task is not done, never 100', () => {
    expect(taskProgress([
      { ts: at(120), task_id: 't', agent: 'isa', status: 'progress', estimated_minutes: 60 },
    ], now)).toMatchObject({ percent: 99, estimatedMinutes: 60, elapsedMinutes: 120 })
  })

  it('is exactly 100 when done', () => {
    expect(taskProgress([
      { ts: at(30), task_id: 't', agent: 'isa', status: 'progress', estimated_minutes: 60 },
      { ts: at(5), task_id: 't', agent: 'isa', status: 'done', estimated_minutes: 60 },
    ], now)).toEqual({ percent: 100, estimatedMinutes: 60, elapsedMinutes: 25 })
  })

  it('shows no progress without an estimate — never invents it', () => {
    expect(taskProgress([
      { ts: at(30), task_id: 't', agent: 'isa', status: 'progress' },
    ], now)).toBeUndefined()
    expect(taskProgress([], now)).toBeUndefined()
  })

  it('takes the estimate from the latest valid event', () => {
    expect(taskProgress([
      { ts: at(30), task_id: 't', agent: 'isa', status: 'progress', estimated_minutes: 30 },
      { ts: at(15), task_id: 't', agent: 'isa', status: 'progress', estimated_minutes: 60 },
    ], now)).toMatchObject({ percent: 50, estimatedMinutes: 60 })
  })

  it('ignores invalid estimates (0, negative)', () => {
    expect(taskProgress([
      { ts: at(30), task_id: 't', agent: 'isa', status: 'progress', estimated_minutes: 60 },
      { ts: at(15), task_id: 't', agent: 'isa', status: 'progress', estimated_minutes: 0 },
    ], now)).toMatchObject({ percent: 50, estimatedMinutes: 60 })
    expect(taskProgress([
      { ts: at(30), task_id: 't', agent: 'isa', status: 'progress', estimated_minutes: -10 },
    ], now)).toBeUndefined()
  })

  it('shows no progress for a task that is only queued', () => {
    expect(taskProgress([
      { ts: at(30), task_id: 't', agent: 'isa', status: 'queued', estimated_minutes: 60 },
    ], now)).toBeUndefined()
  })

  it('restarts the clock when a task is re-opened after being done', () => {
    expect(taskProgress([
      { ts: at(120), task_id: 't', agent: 'isa', status: 'progress', estimated_minutes: 60 },
      { ts: at(90), task_id: 't', agent: 'isa', status: 'done', estimated_minutes: 60 },
      { ts: at(10), task_id: 't', agent: 'isa', status: 'progress', estimated_minutes: 60 },
    ], now)).toMatchObject({ percent: 17, estimatedMinutes: 60, elapsedMinutes: 10 })
  })

  it('agentProgress picks the active task even when a queued event for another task came later', () => {
    const events = [
      { ts: at(30), task_id: 't-active', agent: 'richkeyrick', status: 'progress', estimated_minutes: 60 },
      { ts: at(5), task_id: 't-queued', agent: 'richkeyrick', status: 'queued', estimated_minutes: 90 },
    ]
    expect(agentProgress(events, 'richkeyrick', now)).toEqual({ percent: 50, estimatedMinutes: 60, elapsedMinutes: 30 })
    expect(agentProgress(events, 'isa', now)).toBeUndefined()
  })

  it('agentProgress shows nothing with no active task', () => {
    expect(agentProgress([
      { ts: at(30), task_id: 't', agent: 'neo', status: 'done', estimated_minutes: 60 },
    ], 'neo', now)).toBeUndefined()
    expect(agentProgress([
      { ts: at(30), task_id: 't', agent: 'itc', status: 'queued', estimated_minutes: 60 },
    ], 'itc', now)).toBeUndefined()
  })
})

describe('office snapshot task progress', () => {
  it('attaches % to working agents with an estimate and nothing to the rest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'isa-ledger-progress-'))
    // `now` must be the real clock: the collectors stamp fetchedAt with it, and
    // a future `now` would make every source stale (state Unknown, not Idle).
    const now = Date.now()
    const at = (minutes: number) => new Date(now - minutes * 60000).toISOString()
    const events = [
      { ts: at(15), task_id: 'task-p', agent: 'isa', title: 'Kerja bareng', status: 'progress', estimated_minutes: 45 },
      { ts: at(15), task_id: 'task-p', agent: 'richkeyrick', title: 'Kerja bareng', status: 'progress', estimated_minutes: 45 },
      // A later queued event for another task must not flip Richkeyrick to idle.
      { ts: at(5), task_id: 'task-q', agent: 'richkeyrick', title: 'Tugas antre', status: 'queued', estimated_minutes: 90 },
      { ts: at(60), task_id: 'task-d', agent: 'neo', title: 'Selesai', status: 'done', estimated_minutes: 30 },
      { ts: at(30), task_id: 'task-y', agent: 'itc', title: 'Antre', status: 'queued', estimated_minutes: 60 },
    ]
    writeFileSync(join(dir, 'tasks.jsonl'), events.map((event) => JSON.stringify(event)).join('\n') + '\n')
    writeFileSync(join(dir, 'queue.jsonl'), '')
    writeFileSync(join(dir, 'dispatch.json'), JSON.stringify({ paused: false }))
    const previous = process.env.ISA_LEDGER_DIR
    process.env.ISA_LEDGER_DIR = dir
    try {
      const office = await getLedgerOffice(now)
      const byId = new Map(office.stations.map((station) => [station.id, station]))
      expect(byId.get('isa')).toMatchObject({ state: 'Collaborating', progressPercent: 33, estimatedMinutes: 45, elapsedMinutes: 15 })
      expect(byId.get('richkeyrick')).toMatchObject({ state: 'Collaborating', progressPercent: 33, estimatedMinutes: 45, elapsedMinutes: 15 })
      expect(byId.get('neo')?.progressPercent).toBeUndefined()
      expect(byId.get('itc')?.progressPercent).toBeUndefined()
      expect(byId.get('neo')).toMatchObject({ state: 'Idle' })
    } finally {
      if (previous === undefined) delete process.env.ISA_LEDGER_DIR
      else process.env.ISA_LEDGER_DIR = previous
    }
  })
})
