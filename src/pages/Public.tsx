// Public pages (view-only, ?public=1): Office, Agents, Activity, plus the stats strip.
// Everything here reads ONLY /api/office — the one route the server leaves open
// without the access code. No other /api route is fetched, and no task title is
// ever rendered: station.activity / currentTask / recentActivity can carry the
// title of the task an agent is working on, so public markup uses name, state
// and room only.
import { officeStateBadge } from '../office-state.ts'
import { usePolling } from '../polling.ts'
import { officePollPath } from '../viewers.ts'
import { formatDateTime } from '../format.ts'
import type { OfficeSnapshot, OfficeStation, OfficeState } from '../types.ts'
import { EmptyState, LoadingState, PageTitle, TaskProgressBar } from '../ui.tsx'
import { PixelCharacter } from './Office.tsx'

/** The live office snapshot, read-only, for public pages. */
function usePublicOffice() {
  return usePolling<OfficeSnapshot>(officePollPath(), 10_000)
}

/** Crew summary + crew states, from the office snapshot only. */
export function PublicStats({ office }: { office: OfficeSnapshot | undefined }) {
  if (!office) return <section className="public-stats" aria-label="Crew status"><p className="muted">Crew status is not available right now.</p></section>
  const { summary } = office
  return <section className="public-stats" aria-label="Crew status">
    <p className="eyebrow">CREW STATUS · LIVE</p>
    <h2>{summary.active} working · {summary.idle} idle · {summary.offline} offline · {summary.unknown} unknown</h2>
    <p className="public-stats-summary">Messaging gateways: {summary.gatewaysReachable} of {summary.gatewaysDeclared} · updated {formatDateTime(office.fetchedAt)}</p>
    <div className="crew-list" role="list">{office.stations.map((station) => {
      const badge = officeStateBadge(station.state)
      return <div className="crew-row static" role="listitem" key={station.id}><PixelCharacter agent={station.id}/><span><strong>{station.name}</strong><small>{station.room}</small></span><span className={`badge ${badge.tone}`}>{station.state}</span></div>
    })}</div>
  </section>
}

export function PublicStatsPanel() {
  const snapshot = usePublicOffice()
  if (snapshot.status === 'pending') return <section className="public-stats" aria-label="Crew status"><p className="muted">Reading crew status…</p></section>
  return <PublicStats office={snapshot.status === 'ready' ? snapshot.data : undefined}/>
}

/** Read-only crew list: name, state and room only — no task titles or details. */
export function PublicAgentList({ stations }: { stations: OfficeStation[] }) {
  return <section className="agent-grid">{stations.map((station) => {
    const badge = officeStateBadge(station.state)
    return <article className="agent-card" key={station.id}>
      <span className="folder-glyph" aria-hidden="true"><PixelCharacter agent={station.id}/></span>
      <div className="agent-card-body">
        <h2>{station.privacy === 'locked' ? '🔒 ' : ''}{station.name}</h2>
        <dl>
          <div><dt>State</dt><dd><span className={`badge ${badge.tone}`}>{station.state}</span></dd></div>
          <div><dt>Room</dt><dd>{station.room}</dd></div>
          {/* Number only: the bar never carries a task title, so it is safe in public. */}
          {station.progressPercent !== undefined && <div className="progress-row"><dt>Progress</dt><dd><TaskProgressBar percent={station.progressPercent}/></dd></div>}
        </dl>
      </div>
    </article>
  })}</section>
}

export function PublicAgents() {
  const snapshot = usePublicOffice()
  if (snapshot.status === 'pending') return <><PageTitle eyebrow="CREW" title="Agents"/><LoadingState message="Reading crew list..."/></>
  if (snapshot.status === 'failed' || !snapshot.data) return <><PageTitle eyebrow="CREW" title="Agents"/><EmptyState title="Not Available">The ISA agent list could not be read.</EmptyState></>
  return <><PageTitle eyebrow="CREW" title="Agents">The 7 ISA agents, live from the office. States only — task titles stay private.</PageTitle>
    <PublicAgentList stations={snapshot.data.stations}/>
  </>
}

const STATE_ORDER: OfficeState[] = ['Working', 'Reviewing', 'Collaborating', 'Idle', 'Offline', 'Unknown']

/** Live state board: who is in which state right now, grouped — no task titles. */
export function PublicActivityBoard({ stations, fetchedAt }: { stations: OfficeStation[]; fetchedAt: string }) {
  const groups = STATE_ORDER.map((state) => ({ state, agents: stations.filter((station) => station.state === state) })).filter((group) => group.agents.length > 0)
  return <section className="data-list">
    {groups.length === 0 ? <p className="muted">No crew states to show.</p> : groups.map((group) => {
      const badge = officeStateBadge(group.state)
      return <article key={group.state}><div><h2>{group.state} · {group.agents.length}</h2><p>{group.agents.map((station) => station.name).join(' · ')}</p></div><dl><div><dt>State</dt><dd><span className={`badge ${badge.tone}`}>{group.state}</span></dd></div></dl></article>
    })}
    <p className="muted">Updated {formatDateTime(fetchedAt)} · states only, no task details in public view.</p>
  </section>
}

export function PublicActivity() {
  const snapshot = usePublicOffice()
  if (snapshot.status === 'pending') return <><PageTitle eyebrow="LIVE" title="Activity"/><LoadingState message="Reading crew activity..."/></>
  if (snapshot.status === 'failed' || !snapshot.data) return <><PageTitle eyebrow="LIVE" title="Activity"/><EmptyState title="Not Available">Crew activity could not be read.</EmptyState></>
  return <><PageTitle eyebrow="LIVE" title="Activity">What the crew is doing right now, by state.</PageTitle>
    <PublicActivityBoard stations={snapshot.data.stations} fetchedAt={snapshot.data.fetchedAt}/>
  </>
}
