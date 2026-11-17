import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type NextFunction, type Request, type Response } from 'express'
import { alwaysHiddenFor, excludedFor, FolderError, listFolder, publicAgent, readFolderFile, resolveAgentFolders } from './folders.js'
import { installAccess } from './access.js'
import { redactActivity, redactCalendar, redactDashboard, redactLogs, redactMemory, redactOffice, redactTasks, redactUsage } from './privacy.js'
import { installProfileLock, isHidden, type Privacy } from './profile-lock.js'
import { API_VERSION } from './api-version.js'
import { collectMemory } from './memory.js'
import { recordViewer } from './viewers.js'
import { getActivity, getCalendar, getChannels, getCommandLog, getDashboard, getKnowledge, getLogs, getOffice, getSnapshot, getTaskBoard, getTaskDetail, getUsage } from './mission-control.js'
import { collectLedgerActivity, collectLedgerCalendar, collectLedgerChannels, collectLedgerKnowledge, collectLedgerLogs, collectLedgerRuntime, collectLedgerTaskBoard, collectLedgerUsage, getLedgerDashboard, getLedgerOffice, getLedgerTaskDetail, isLedgerMode } from './ledger.js'

const HOST = '127.0.0.1'
// MISSION_CONTROL_PORT is the pre-rename name, still honoured.
const PORT = Number(process.env.RUANG_PORT ?? process.env.MISSION_CONTROL_PORT) || 3001
// The built UI sits next to the server: ../dist from server/*.ts (development, npm start)
// and ../../dist from build/server/*.js (the installed package).
const distDirectory = [new URL('../dist', import.meta.url), new URL('../../dist', import.meta.url)].map((url) => fileURLToPath(url)).find((path) => existsSync(join(path, 'index.html'))) ?? fileURLToPath(new URL('../dist', import.meta.url))

const app = express()
app.disable('x-powered-by')
app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
})

const startedAt = new Date().toISOString()
app.get('/api/health', (_request, response) => { response.json({ ok: true, apiVersion: API_VERSION, startedAt }) })

// Optional access code (off by default): locks every other /api route until it is entered.
installAccess(app)
// Optional profile lock (off by default): a PIN withholds the private data of chosen agents.
const privacyOf = installProfileLock(app)

// `?fresh=1` (manual refresh) bypasses the 10s cache for anything older than 2s.
const FRESH_WINDOW_MS = 8_000
// Every snapshot is shared and cached; the private data of locked agents is withheld per request.
// In ledger mode (ISA_LEDGER_DIR set, or the ISA ledger exists) the data comes from the ISA
// ledger instead of the `hermes` CLI; the endpoint shapes stay identical.
const ledger = isLedgerMode()
const routes: Record<string, (now: number, privacy: Privacy) => Promise<unknown> | unknown> = {
  '/api/runtime': (now) => ledger ? collectLedgerRuntime() : getSnapshot(now),
  '/api/dashboard': async (now, privacy) => redactDashboard(await (ledger ? getLedgerDashboard(now) : getDashboard(now)), privacy),
  '/api/tasks': async (now, privacy) => redactTasks(await (ledger ? collectLedgerTaskBoard() : getTaskBoard(now)), privacy),
  '/api/calendar': async (now, privacy) => redactCalendar(await (ledger ? collectLedgerCalendar() : getCalendar(now)), privacy),
  '/api/activity': async (now, privacy) => redactActivity(await (ledger ? collectLedgerActivity() : getActivity(now)), privacy),
  '/api/knowledge': (now) => ledger ? collectLedgerKnowledge() : getKnowledge(now),
  '/api/office': async (now, privacy) => redactOffice(await (ledger ? getLedgerOffice(now) : getOffice(now)), privacy),
  '/api/channels': (now) => ledger ? collectLedgerChannels() : getChannels(now),
  '/api/logs': async (now, privacy) => redactLogs(await (ledger ? collectLedgerLogs() : getLogs(now)), privacy),
  '/api/command-log': () => getCommandLog(),
}
for (const [path, handler] of Object.entries(routes)) {
  app.get(path, async (request, response) => {
    const now = Date.now() + (request.query.fresh === '1' ? FRESH_WINDOW_MS : 0)
    const result = await handler(now, await privacyOf(request))
    if (path === '/api/office' && result && typeof result === 'object') {
      // Live viewer counter (see server/viewers.ts): one entry per browser tab
      // polling /api/office in the last 30s. A plain number — no identities.
      ;(result as { viewersNow?: number }).viewersNow = recordViewer(typeof request.query.viewer === 'string' ? request.query.viewer : undefined)
    }
    response.json(result)
  })
}
const locked = (response: Response, agent: string) => response.status(423).json({ error: `🔒 ${agent} is locked. Enter the PIN to see it.`, locked: 'profile', agent })
app.get('/api/usage', async (request, response) => {
  const now = Date.now() + (request.query.fresh === '1' ? FRESH_WINDOW_MS : 0)
  const days = Number(request.query.days) || 7
  response.json(redactUsage(await (ledger ? collectLedgerUsage(days) : getUsage(days, now)), await privacyOf(request)))
})
app.get('/api/tasks/:id', async (request, response) => {
  const board = typeof request.query.board === 'string' && request.query.board ? request.query.board : undefined
  const privacy = await privacyOf(request)
  const listed = (await (ledger ? collectLedgerTaskBoard() : getTaskBoard())).tasks.data.find((task) => task.id === request.params.id && task.board === board)
  if (listed && isHidden(privacy, listed.assignee)) { locked(response, listed.assignee!); return }
  const detail = ledger ? await getLedgerTaskDetail(String(request.params.id), board) : await getTaskDetail(String(request.params.id), Date.now(), board)
  if (!detail) { response.status(404).json({ error: 'Unknown task.' }); return }
  const assignee = detail.task.data?.assignee
  if (isHidden(privacy, assignee)) { locked(response, assignee!); return }
  response.json(detail)
})

// Folders: read-only view of each agent's own folder. Only agents the server resolved
// (every Hermes profile this machine reports, and OpenCode when installed) can be opened.
// In ledger mode the agents are the ISA roster, so their folders resolve the same way
// and report honestly when they do not exist.
async function agentFolders() {
  const runtime = await (ledger ? collectLedgerRuntime() : getSnapshot())
  return resolveAgentFolders(runtime.profiles.data.map((profile) => profile.name))
}
async function openFolder(profile: string) {
  const folders = await agentFolders()
  const folder = folders.find((item) => item.profile === profile)
  if (!folder) throw new FolderError('Unknown agent.', 404)
  if (!folder.available) throw new FolderError(folder.reason ?? 'Folder not available.', 404)
  // Other agents' folders inside this one are hidden, and the Hermes profiles folder always is.
  return { folder, excluded: [...excludedFor(folder, folders), ...(await alwaysHiddenFor(folder))] }
}
function folderRoute(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request, response: Response) => {
    try {
      response.json(await handler(request))
    } catch (error) {
      if (error instanceof FolderError) { response.status(error.status).json({ error: error.message }); return }
      throw error
    }
  }
}
app.get('/api/memory', folderRoute(async (request) => redactMemory(await collectMemory(await agentFolders()), await privacyOf(request))))
app.get('/api/folders', folderRoute(async () => ({ agents: (await agentFolders()).map(publicAgent), fetchedAt: new Date().toISOString() })))
/** A locked agent's folder answers 423 (Locked) until the PIN unlocks it in this browser. */
async function guardFolder(request: Request) {
  const profile = String(request.params.profile)
  if (isHidden(await privacyOf(request), profile)) throw new FolderError(`🔒 ${profile} is locked. Enter the PIN to see it.`, 423)
  return openFolder(profile)
}
app.get('/api/folders/:profile/list', folderRoute(async (request) => {
  const { folder, excluded } = await guardFolder(request)
  return listFolder(folder, request.query.path, excluded)
}))
app.get('/api/folders/:profile/file', folderRoute(async (request) => {
  const { folder, excluded } = await guardFolder(request)
  return readFolderFile(folder, request.query.path, excluded)
}))

app.use('/api', (_request, response) => { response.status(404).json({ error: 'Not found' }) })

if (existsSync(distDirectory)) {
  app.use(express.static(distDirectory))
  app.get(/^(?!\/api\/).*/, (_request, response) => { response.sendFile('index.html', { root: distDirectory }) })
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  void _next
  console.error('Mission Control ISA request failed:', error instanceof Error ? error.message : error)
  response.status(500).json({ error: 'Internal error' })
})

app.listen(PORT, HOST, () => console.log(`Mission Control ISA listening on http://${HOST}:${PORT}${existsSync(distDirectory) ? ' (serving built UI)' : ' (API only; run the Vite dev server for the UI)'} — data source: ${ledger ? 'ISA ledger' : 'hermes CLI'}`))
