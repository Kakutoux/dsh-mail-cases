import { Store } from '../lib/db.js'
import fs from 'node:fs'
const p = 'C:/Users/cwiop/AppData/Local/Temp/mc-state-test.db'
try { fs.unlinkSync(p) } catch {}
const store = new Store(p)
const raw = store.db
raw.prepare("insert into cases (createdAt, updatedAt, title, customer, fromAddrs, status, summary, asks, suggestions, lastActivityAt, primaryDate) values (?,?,?,?,?,?,?,?,?,?,?)")
  .run(new Date().toISOString(), new Date().toISOString(), 't', 'c', 'a@b.com', 'todo', '', '[]', '[]', new Date().toISOString(), '2026-11-10')
const caseId = raw.prepare('select id from cases order by id desc limit 1').get().id
const read = () => raw.prepare('select status, archivedAt from cases where id = ?').get(caseId)
store.setState(caseId, 'doing'); console.log('doing ->', JSON.stringify(read()))
store.setState(caseId, 'done'); console.log('done  ->', JSON.stringify(read()))
store.setState(caseId, 'waiting'); console.log('waiting ->', JSON.stringify(read()))
