import { useEffect, useMemo, useRef, useState } from 'react'

/* ---------- helpers ---------- */

const CURRENCIES = ['DKK', 'EUR', 'USD', 'GBP', 'SEK', 'NOK', 'CHF', 'PLN', 'CZK', 'ISK', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN', 'TRY', 'ZAR']
const EMOJIS = ['🛒', '🍽️', '☕', '🍺', '🚗', '⛽', '🏠', '💡', '🎬', '🎮', '👕', '💊', '🐶', '🎁', '✈️', '📚', '💇', '🏋️', '🧴', '🌱']
const GRADIENTS = [
  { name: 'Mint → Coral', good: '#4fb286', bad: '#e5645a' },
  { name: 'Sky → Plum', good: '#4a9fd8', bad: '#a8479b' },
  { name: 'Sage → Amber', good: '#7aa874', bad: '#e0912f' },
  { name: 'Teal → Rose', good: '#2f9e9a', bad: '#d9577c' },
]

const uid = () => Math.random().toString(36).slice(2, 10)
const monthKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
}
const prevMonthKey = () => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return monthKey(d)
}
const daysLeftInMonth = () => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate() - n.getDate() + 1
}
const money = (n, cur) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: Math.abs(n) % 1 ? 2 : 0 }).format(n)
  } catch {
    return `${n} ${cur}`
  }
}
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`
}
const spentIn = (b, key) => b.entries.filter((e) => monthKey(e.date) === key).reduce((s, e) => s + e.amount, 0)

/* ---------- persistence ---------- */

function usePersistedState() {
  const [state, setState] = useState({ budgets: [] })
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/state')
      .then((r) => r.json())
      .then((s) => setState(s))
      .catch(() => {
        // no backend (e.g. plain static hosting): fall back to this browser only
        try {
          setState(JSON.parse(localStorage.getItem('budgetly') || '{"budgets":[]}'))
        } catch {}
        setFailed(true)
      })
      .finally(() => setLoaded(true))
  }, [])

  // pick up changes made from another device when coming back to the tab
  useEffect(() => {
    if (!loaded || failed) return
    const sync = () => {
      if (document.visibilityState !== 'visible') return
      fetch('/api/state')
        .then((r) => r.json())
        .then((s) => setState((cur) => (JSON.stringify(cur) === JSON.stringify(s) ? cur : s)))
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [loaded, failed])

  const timer = useRef()
  useEffect(() => {
    if (!loaded) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (failed) {
        try {
          localStorage.setItem('budgetly', JSON.stringify(state))
        } catch {}
        return
      }
      fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }).catch(() => {})
    }, 300)
    return () => clearTimeout(timer.current)
  }, [state, loaded, failed])

  return [state, setState, loaded]
}

/* ---------- theme ---------- */

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('budgetly-theme') || (systemDark() ? 'dark' : 'light')
    } catch {
      return systemDark() ? 'dark' : 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#25221b' : '#f6f0de')
    try {
      localStorage.setItem('budgetly-theme', theme)
    } catch {}
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

/* ---------- radial ---------- */

function Ring({ budget, spent, size = 168 }) {
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const used = budget.amount > 0 ? spent / budget.amount : 1
  const left = Math.min(Math.max(1 - used, 0), 1)
  const color = mix(budget.good, budget.bad, Math.min(used, 1))
  const remaining = budget.amount - spent
  const over = remaining < 0

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (over ? 1 : left))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-arc"
        />
      </svg>
      <div className="ring-center">
        <span className="ring-emoji">{budget.emoji}</span>
        <span className="ring-left" style={{ color: over ? budget.bad : undefined }}>
          {money(Math.abs(remaining), budget.currency)}
        </span>
        <span className="ring-sub">{over ? 'over budget' : 'left'}</span>
      </div>
    </div>
  )
}

/* ---------- modals ---------- */

function Modal({ children, onClose }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">{children}</div>
    </div>
  )
}

function BudgetForm({ initial, onSave, onClose, onDelete }) {
  const [f, setF] = useState(
    initial || { name: '', emoji: '🛒', currency: 'DKK', amount: '', good: GRADIENTS[0].good, bad: GRADIENTS[0].bad }
  )
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const valid = f.name.trim() && Number(f.amount) > 0

  return (
    <Modal onClose={onClose}>
      <h2>{initial ? 'Edit budget' : 'New budget'}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSave({ ...f, name: f.name.trim(), amount: Number(f.amount), emoji: f.emoji || '💰' })
        }}
      >
        <div className="row">
          <label className="field emoji-field">
            <span>Icon</span>
            <input value={f.emoji} onChange={(e) => set('emoji', [...e.target.value].slice(-2).join(''))} aria-label="Emoji" />
          </label>
          <label className="field grow">
            <span>Name</span>
            <input autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Groceries" />
          </label>
        </div>
        <div className="emoji-picks">
          {EMOJIS.map((e) => (
            <button type="button" key={e} className={e === f.emoji ? 'on' : ''} onClick={() => set('emoji', e)}>
              {e}
            </button>
          ))}
        </div>
        <div className="row">
          <label className="field grow">
            <span>Monthly budget</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="3000" />
          </label>
          <label className="field">
            <span>Currency</span>
            <select value={f.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="field">
          <span>Ring colors — full → empty</span>
          <div className="gradient-bar" style={{ background: `linear-gradient(90deg, ${f.good}, ${f.bad})` }} />
          <div className="row colors">
            <label>
              <input type="color" value={f.good} onChange={(e) => set('good', e.target.value)} /> Good
            </label>
            <label>
              <input type="color" value={f.bad} onChange={(e) => set('bad', e.target.value)} /> Bad
            </label>
          </div>
          <div className="presets">
            {GRADIENTS.map((g) => (
              <button
                type="button"
                key={g.name}
                title={g.name}
                style={{ background: `linear-gradient(90deg, ${g.good}, ${g.bad})` }}
                onClick={() => setF((p) => ({ ...p, good: g.good, bad: g.bad }))}
              />
            ))}
          </div>
        </div>

        <div className="actions">
          {onDelete && (
            <button type="button" className="btn danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!valid}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Detail({ budget, onClose, onChange, onEdit }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const key = monthKey(new Date())
  const entries = budget.entries.filter((e) => monthKey(e.date) === key).sort((a, b) => b.date.localeCompare(a.date))
  const spent = entries.reduce((s, e) => s + e.amount, 0)
  const last = spentIn(budget, prevMonthKey())

  const add = (e) => {
    e.preventDefault()
    const n = Number(amount)
    if (!n) return
    onChange({ ...budget, entries: [...budget.entries, { id: uid(), amount: n, note: note.trim(), date: new Date().toISOString() }] })
    setAmount('')
    setNote('')
  }
  const remove = (id) => onChange({ ...budget, entries: budget.entries.filter((e) => e.id !== id) })

  return (
    <Modal onClose={onClose}>
      <div className="detail-head">
        <h2>
          {budget.emoji} {budget.name}
        </h2>
        <button className="btn ghost small" onClick={onEdit}>
          Edit
        </button>
      </div>
      <div className="detail-ring">
        <Ring budget={budget} spent={spent} size={190} />
        <p className="muted">
          {money(spent, budget.currency)} of {money(budget.amount, budget.currency)} · resets in {daysLeftInMonth()} days
          {last > 0 && <> · last month {money(last, budget.currency)}</>}
        </p>
      </div>

      <form className="add" onSubmit={add}>
        <input autoFocus type="number" inputMode="decimal" step="any" placeholder="Amount spent" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn primary" disabled={!Number(amount)}>
          Add
        </button>
      </form>

      <ul className="entries">
        {entries.length === 0 && <li className="muted empty">Nothing spent this month yet.</li>}
        {entries.map((e) => (
          <li key={e.id}>
            <span className="date">{new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
            <span className="grow note">{e.note || '—'}</span>
            <span className="amt">{money(e.amount, budget.currency)}</span>
            <button className="x" onClick={() => remove(e.id)} aria-label="Remove entry">
              ×
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

/* ---------- app ---------- */

export default function App() {
  const [state, setState, loaded] = usePersistedState()
  const [view, setView] = useState(null) // {type:'detail'|'edit'|'new', id}
  const [theme, toggleTheme] = useTheme()
  const key = monthKey(new Date())
  const month = useMemo(() => new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), [])

  const update = (b) => setState((s) => ({ ...s, budgets: s.budgets.map((x) => (x.id === b.id ? b : x)) }))
  const current = view?.id && state.budgets.find((b) => b.id === view.id)

  return (
    <main>
      <header>
        <div>
          <h1>Budgetly</h1>
          <p className="muted">
            {month} · resets in {daysLeftInMonth()} days
          </p>
        </div>
        <div className="header-actions">
          <button className="btn theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title="Toggle light/dark">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn primary" onClick={() => setView({ type: 'new' })}>
            + New budget
          </button>
        </div>
      </header>

      {loaded && state.budgets.length === 0 && (
        <div className="empty-state">
          <div className="big">🍦</div>
          <p>No budgets yet. Create one for groceries, eating out, fun — anything you want to keep an eye on each month.</p>
        </div>
      )}

      <section className="grid">
        {state.budgets.map((b) => (
          <button key={b.id} className="card" onClick={() => setView({ type: 'detail', id: b.id })}>
            <Ring budget={b} spent={spentIn(b, key)} />
            <div className="card-name">{b.name}</div>
            <div className="muted">
              {money(spentIn(b, key), b.currency)} / {money(b.amount, b.currency)}
            </div>
          </button>
        ))}
      </section>

      {view?.type === 'new' && (
        <BudgetForm
          onClose={() => setView(null)}
          onSave={(f) => {
            const id = uid()
            setState((s) => ({ ...s, budgets: [...s.budgets, { ...f, id, entries: [] }] }))
            setView({ type: 'detail', id })
          }}
        />
      )}
      {view?.type === 'edit' && current && (
        <BudgetForm
          initial={current}
          onClose={() => setView({ type: 'detail', id: current.id })}
          onSave={(f) => {
            update({ ...current, ...f })
            setView({ type: 'detail', id: current.id })
          }}
          onDelete={() => {
            if (confirm(`Delete "${current.name}" and all its history?`)) {
              setState((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== current.id) }))
              setView(null)
            }
          }}
        />
      )}
      {view?.type === 'detail' && current && (
        <Detail budget={current} onClose={() => setView(null)} onChange={update} onEdit={() => setView({ type: 'edit', id: current.id })} />
      )}
    </main>
  )
}
