import { useEffect, useMemo, useRef, useState } from 'react'

type DatePickerProps = {
  ariaLabel: string
  emptyLabel?: string
  value: string
  onChange: (value: string) => void
  showTime?: boolean
  timeValue?: string
  onTimeChange?: (value: string) => void
  minValue?: string
}

const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function CalendarArrow({ direction }: { direction: 'previous' | 'next' }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={direction === 'previous' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} /></svg>
}

function TimeWheelColumn({ label, value, count, onChange }: { label: string; value: number; count: number; onChange: (value: number) => void }) {
  const wheelRef = useRef<HTMLDivElement>(null)
  const scrollFrame = useRef<number | null>(null)
  useEffect(() => {
    if (wheelRef.current) wheelRef.current.scrollTop = value * 34
    return () => { if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current) }
  }, [])
  const select = (next: number) => {
    const normalized = (next + count) % count
    onChange(normalized)
    if (wheelRef.current) wheelRef.current.scrollTo({ top: normalized * 34, behavior: 'smooth' })
  }
  return <div className="dashboard-time-wheel-column">
    <span className="dashboard-time-wheel-label">{label}</span>
    <div ref={wheelRef} className="dashboard-time-wheel" role="listbox" aria-label={label} tabIndex={0} aria-activedescendant={`${label}-${value}`} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); select(value + (event.key === 'ArrowDown' ? 1 : -1)) }
    }} onScroll={(event) => {
      if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current)
      const wheel = event.currentTarget
      scrollFrame.current = window.requestAnimationFrame(() => {
        const next = Math.max(0, Math.min(count - 1, Math.round(wheel.scrollTop / 34)))
        if (next !== value) onChange(next)
      })
    }}>
      {Array.from({ length: count }, (_, item) => <button id={`${label}-${item}`} key={item} type="button" role="option" aria-selected={item === value} tabIndex={-1} className={item === value ? 'is-selected' : ''} onClick={() => select(item)}>{String(item).padStart(2, '0')}</button>)}
    </div>
  </div>
}

function TimeWheel({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [hours, minutes, seconds] = value.split(':').map(Number)
  const update = (part: number, nextValue: number) => {
    const parts = [hours, minutes, seconds]
    parts[part] = nextValue
    onChange(parts.map((item) => String(item).padStart(2, '0')).join(':'))
  }
  return <div className="dashboard-time-picker" aria-label="Chọn giờ, phút và giây">
    <TimeWheelColumn label="Giờ" value={hours || 0} count={24} onChange={(next) => update(0, next)} />
    <span className="dashboard-time-separator" aria-hidden="true">:</span>
    <TimeWheelColumn label="Phút" value={minutes || 0} count={60} onChange={(next) => update(1, next)} />
    <span className="dashboard-time-separator" aria-hidden="true">:</span>
    <TimeWheelColumn label="Giây" value={seconds || 0} count={60} onChange={(next) => update(2, next)} />
  </div>
}

export default function DatePicker({ ariaLabel, emptyLabel = 'dd/mm/yyyy', value, onChange, showTime = false, timeValue = '00:00:00', onTimeChange, minValue = '' }: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => value ? fromDateKey(value) : new Date())
  const today = dateKey(new Date())
  const selectedDate = value ? fromDateKey(value) : null
  const monthTitle = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(visibleMonth)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const mondayOffset = (firstDay.getDay() + 6) % 7
    const firstCell = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - mondayOffset)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + index)
      return { date, key: dateKey(date), inMonth: date.getMonth() === visibleMonth.getMonth() }
    })
  }, [visibleMonth])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const selectDate = (nextValue: string) => {
    onChange(nextValue)
    setVisibleMonth(fromDateKey(nextValue))
    if (!showTime) {
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  const displayedValue = selectedDate ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(selectedDate) : emptyLabel

  return <div ref={rootRef} className={`dashboard-date-picker${open ? ' is-open' : ''}`}>
    <button ref={triggerRef} type="button" className={`dashboard-date-trigger${value ? ' has-value' : ''}`} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} onClick={() => {
      if (!open) setVisibleMonth(value ? fromDateKey(value) : new Date())
      setOpen((current) => !current)
    }}>
      <span>{displayedValue}{showTime && <time className="dashboard-date-time-value">{timeValue}</time>}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="15" rx="2" /><path d="M8 3v6m8-6v6M4 10h16" /></svg>
    </button>
    {open && <section className={`dashboard-calendar${showTime ? ' has-time' : ''}`} role="dialog" aria-label={showTime ? 'Chọn ngày và giờ' : 'Chọn ngày'}>
      <header className="dashboard-calendar-header">
        <strong>{monthTitle}</strong>
        <div><button type="button" aria-label="Tháng trước" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}><CalendarArrow direction="previous" /></button><button type="button" aria-label="Tháng sau" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}><CalendarArrow direction="next" /></button></div>
      </header>
      <div className="dashboard-calendar-grid" aria-label={monthTitle}>
        {weekdayLabels.map((day) => <span className="dashboard-calendar-weekday" key={day}>{day}</span>)}
        {calendarDays.map(({ date, key, inMonth }) => <button key={key} type="button" className={`dashboard-calendar-day${inMonth ? '' : ' is-outside'}${key === value ? ' is-selected' : ''}${key === today ? ' is-today' : ''}${minValue && key < minValue ? ' is-disabled' : ''}`} aria-label={date.toLocaleDateString('vi-VN', { dateStyle: 'full' })} aria-pressed={key === value} disabled={Boolean(minValue && key < minValue)} onClick={() => selectDate(key)}>{date.getDate()}</button>)}
      </div>
      {showTime && onTimeChange && <TimeWheel value={timeValue} onChange={onTimeChange} />}
      <footer className="dashboard-calendar-footer"><button type="button" className="dashboard-calendar-clear" onClick={() => { onChange(''); setOpen(false); triggerRef.current?.focus() }} disabled={!value}>Xóa ngày</button>{showTime ? <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus() }}>Xong</button> : <button type="button" onClick={() => selectDate(today)}>Hôm nay</button>}</footer>
    </section>}
  </div>
}
