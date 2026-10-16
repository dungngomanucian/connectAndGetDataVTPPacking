import { useEffect, useId, useRef, useState } from 'react'
import { loadWarehouseChoices, loadWarehouseChoice, type WarehouseChoice } from './api'


export default function WarehousePicker({ value, onChange, allowAll = false, compact = false }: { value: string; onChange: (id: string) => void; allowAll?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([])
  const [selected, setSelected] = useState<Pick<WarehouseChoice, 'id' | 'name'> | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      void loadWarehouseChoices({ q: query, limit: 20, offset: page * 20 }).then((response) => {
        if (active) { setItems(response.items); setTotal(response.total); setError('') }
      }).catch(() => { if (active) setError('Không tải được danh sách kho') })
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [query, page])
  useEffect(() => {
    let active = true
    if (value) void loadWarehouseChoice(value).then((item) => { if (active) setSelected(item) }).catch(() => {})
    else setSelected(null)
    return () => { active = false }
  }, [value])
  const choices = selected && !items.some((item) => item.id === selected.id) ? [selected, ...items] : items
  if (compact) {
    const choose = (id: string) => {
      setSelected(choices.find((item) => item.id === id) || null)
      onChange(id)
      setOpen(false)
      triggerRef.current?.focus()
    }
    return <div ref={containerRef} className={`ui-dropdown warehouse-picker-compact ${open ? 'is-open' : ''}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false)
    }} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); triggerRef.current?.focus() }
    }}>
      <button ref={triggerRef} type="button" className="ui-dropdown-trigger" aria-label="Chọn kho" aria-haspopup="dialog" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((current) => !current)}>
        <span>{value ? choices.find((item) => item.id === value)?.name || 'Kho đã chọn' : allowAll ? 'Tất cả kho' : 'Chọn kho'}</span>
        <svg className="ui-dropdown-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5" /></svg>
      </button>
      {open && <div id={menuId} className="warehouse-picker-menu" role="dialog" aria-label="Chọn kho">
        <input autoFocus aria-label="Tìm kho" placeholder="Tìm kho…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} />
        <div className="warehouse-picker-options">
          <button type="button" aria-pressed={!value} onClick={() => choose('')}>{allowAll ? 'Tất cả kho' : 'Chọn kho'}</button>
          {choices.map((item) => <button key={item.id} type="button" aria-pressed={value === item.id} onClick={() => choose(item.id)}>{item.name}</button>)}
          {!items.length && !error && <small role="status">Không có kho phù hợp</small>}
        </div>
        {total > 20 && <div className="warehouse-picker-pagination"><button type="button" aria-label="Trang kho trước" disabled={!page} onClick={() => setPage((p) => p - 1)}>‹</button><span>{page + 1}/{Math.ceil(total / 20)}</span><button type="button" aria-label="Trang kho sau" disabled={(page + 1) * 20 >= total} onClick={() => setPage((p) => p + 1)}>›</button></div>}
        {error && <small role="status">{error}</small>}
      </div>}
    </div>
  }
  return <span className="warehouse-picker">
    <input aria-label="Tìm kho" placeholder="Tìm kho…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} />
    <select aria-label="Chọn kho" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{allowAll ? 'Tất cả kho' : 'Chọn kho'}</option>{choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    {total > 20 && <span><button type="button" disabled={!page} onClick={() => setPage((p) => p - 1)}>‹</button>
      <span>{page + 1}/{Math.ceil(total / 20)}</span>
      <button type="button" disabled={(page + 1) * 20 >= total} onClick={() => setPage((p) => p + 1)}>›</button></span>}
    {error && <small role="status">{error}</small>}
  </span>
}
