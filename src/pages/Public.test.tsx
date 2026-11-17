import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PublicShell } from '../App.tsx'
import { FloorButtons, RotateButtons } from './Office3D.tsx'
import { PublicActivityBoard, PublicAgentList, PublicStats } from './Public.tsx'
import type { OfficeSnapshot, OfficeStation } from '../types.ts'

// A working station whose task-bearing fields all carry the same title, so any
// leak of a task title into public markup is caught by one assertion.
const working: OfficeStation = {
  id: 'isa', name: 'ISA', role: 'Chief Orchestrator', room: 'Workspace', roomPosition: 'review-desk',
  state: 'Working', currentTask: 'Secret task title', recentActivity: 'Secret task title (last log 06:30)',
  activity: 'Secret task title', seat: 1, provenance: 'ISA ledger (tasks.jsonl)', freshness: 'Runtime current',
}
const idle: OfficeStation = {
  id: 'neo', name: 'NEO AI', role: 'Router / Intake', room: 'Lounge', roomPosition: 'lounge-seat-3',
  state: 'Idle', currentTask: 'No attributed task', recentActivity: 'No activity in the last 3m',
  activity: 'On a break', seat: 3, provenance: 'ISA ledger (tasks.jsonl)', freshness: 'Runtime current',
}
const snapshot: OfficeSnapshot = {
  stations: [working, idle],
  summary: { declared: 2, active: 1, idle: 1, offline: 0, unknown: 0, gatewaysReachable: 0, gatewaysDeclared: 0 },
  fetchedAt: '2026-11-17T06:30:00.000Z',
}

describe('Public stats strip', () => {
  it('shows crew states and counts from the office snapshot only, never a task title', () => {
    const markup = renderToStaticMarkup(<PublicStats office={snapshot}/>)
    expect(markup).toContain('ISA')
    expect(markup).toContain('NEO AI')
    expect(markup).toContain('Working')
    expect(markup).toContain('Idle')
    expect(markup).toContain('1 working · 1 idle')
    expect(markup).not.toContain('Secret task title')
    expect(markup).not.toContain('No attributed task')
    expect(markup).not.toContain('On a break')
  })

  it('says so when the snapshot is missing', () => {
    expect(renderToStaticMarkup(<PublicStats office={undefined}/>)).toContain('not available')
  })
})

describe('Public Agents list', () => {
  it('lists name, state and room only — no task titles or details', () => {
    const markup = renderToStaticMarkup(<PublicAgentList stations={[working, idle]}/>)
    expect(markup).toContain('ISA')
    expect(markup).toContain('Workspace')
    expect(markup).toContain('Lounge')
    expect(markup).not.toContain('Secret task title')
    expect(markup).not.toContain('Chief Orchestrator')
    expect(markup).not.toContain('On a break')
  })
})

describe('Public Activity board', () => {
  it('groups agents by state without task titles', () => {
    const markup = renderToStaticMarkup(<PublicActivityBoard stations={[working, idle]} fetchedAt={snapshot.fetchedAt}/>)
    expect(markup).toContain('Working · 1')
    expect(markup).toContain('Idle · 1')
    expect(markup).toContain('ISA')
    expect(markup).toContain('NEO AI')
    expect(markup).not.toContain('Secret task title')
  })
})

describe('Public floor buttons', () => {
  it('renders both floors with the active floor pressed', () => {
    const markup = renderToStaticMarkup(<FloorButtons floor={1} onFloor={vi.fn()} counts={() => 3}/>)
    expect(markup).toContain('Kantor')
    expect(markup).toContain('Kamar &amp; Balkon')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('aria-pressed="false"')
  })
})

describe('Rotate buttons', () => {
  it('renders hold-to-rotate buttons with accessible labels', () => {
    const markup = renderToStaticMarkup(<RotateButtons view={{ current: null }}/>)
    expect(markup).toContain('aria-label="Putar kamera"')
    expect(markup).toContain('aria-label="Putar kiri"')
    expect(markup).toContain('aria-label="Putar kanan"')
    expect(markup).toContain('⟲')
    expect(markup).toContain('⟳')
    expect(markup).toContain('tahan')
  })
})

describe('Public shell', () => {
  it('shows the office title, the public nav, the admin entry and the footer', () => {
    const markup = renderToStaticMarkup(<PublicShell/>)
    expect(markup).toContain('SUPER AGENTIC | I.S.A')
    expect(markup).toContain('RICHKEYRICK OFFICE')
    expect(markup).toContain('office-title')
    expect(markup).toContain('Agents')
    expect(markup).toContain('Activity')
    expect(markup).toContain('Masuk sebagai admin')
    expect(markup).toContain('?admin=1')
    expect(markup).toContain('Richkeyrick')
    expect(markup).toContain('public-footer')
  })
})
