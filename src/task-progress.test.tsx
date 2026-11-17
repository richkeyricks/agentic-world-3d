import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TaskProgressBar } from './ui.tsx'
import { PublicAgentList } from './pages/Public.tsx'
import type { OfficeStation } from './types.ts'

const working: OfficeStation = {
  id: 'isa', name: 'ISA', role: 'Chief Orchestrator', room: 'Workspace', roomPosition: 'review-desk',
  state: 'Working', currentTask: 'Secret task title', recentActivity: 'Secret task title (last log 06:30)',
  activity: 'Secret task title', seat: 1, provenance: 'ISA ledger (tasks.jsonl)', freshness: 'Runtime current',
  progressPercent: 45, estimatedMinutes: 45, elapsedMinutes: 20,
}
const idle: OfficeStation = {
  id: 'neo', name: 'NEO AI', role: 'Router / Intake', room: 'Lounge', roomPosition: 'lounge-seat-3',
  state: 'Idle', currentTask: 'No attributed task', recentActivity: 'No activity in the last 3m',
  activity: 'On a break', seat: 3, provenance: 'ISA ledger (tasks.jsonl)', freshness: 'Runtime current',
}

describe('TaskProgressBar', () => {
  it('renders the bar, the % and the detail when a percent is given', () => {
    const markup = renderToStaticMarkup(<TaskProgressBar percent={45} detail="20 dari 45 menit"/>)
    expect(markup).toContain('task-progress')
    expect(markup).toContain('45%')
    expect(markup).toContain('width:45%')
    expect(markup).toContain('20 dari 45 menit')
  })

  it('renders nothing without a percent — no estimate, no bar', () => {
    expect(renderToStaticMarkup(<TaskProgressBar percent={undefined}/>)).toBe('')
  })

  it('clamps the fill to 0–100', () => {
    expect(renderToStaticMarkup(<TaskProgressBar percent={150}/>)).toContain('width:100%')
    expect(renderToStaticMarkup(<TaskProgressBar percent={-5}/>)).toContain('width:0%')
  })
})

describe('Public Agents list with progress', () => {
  it('shows the bar + % and still no task title', () => {
    const markup = renderToStaticMarkup(<PublicAgentList stations={[working, idle]}/>)
    expect(markup).toContain('45%')
    expect(markup).toContain('task-progress')
    expect(markup).not.toContain('Secret task title')
    // Public shows the number only — no elapsed/estimate minutes.
    expect(markup).not.toContain('20 dari 45 menit')
    expect(markup).not.toContain('estimatedMinutes')
  })

  it('shows no bar for an agent without an estimate', () => {
    const markup = renderToStaticMarkup(<PublicAgentList stations={[idle]}/>)
    expect(markup).not.toContain('task-progress')
    expect(markup).toContain('NEO AI')
  })
})
