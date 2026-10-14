import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'

export type DropdownOption = {
  value: string
  label: string
  group?: string
  disabled?: boolean
}

type DropdownProps = {
  ariaLabel: string
  className?: string
  defaultValue?: string
  disabled?: boolean
  name?: string
  onChange?: (value: string) => void
  options: DropdownOption[]
  value?: string
}

function ChevronIcon() {
  return <svg className="ui-dropdown-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5" /></svg>
}

export default function Dropdown({ ariaLabel, className = '', defaultValue, disabled = false, name, onChange, options, value }: DropdownProps) {
  const controlled = value !== undefined
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? options[0]?.value ?? '')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listId = useId()
  const selectedValue = controlled ? value : uncontrolledValue
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selectedValue))
  const selectedOption = options[selectedIndex]
  const displayLabel = (label: string) => ariaLabel === 'Luồng camera' ? label.replace(/ \((?:MAIN|SUB)\)$/, '') : label
  const enabledIndexes = useMemo(() => options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0), [options])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const focusOption = (index: number) => {
    if (!enabledIndexes.length) return
    const nextIndex = enabledIndexes.includes(index) ? index : enabledIndexes[0]
    setActiveIndex(nextIndex)
    window.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus())
  }

  const openMenu = (targetIndex = selectedIndex) => {
    if (disabled || !enabledIndexes.length) return
    setOpen(true)
    focusOption(targetIndex)
  }

  const choose = (nextValue: string) => {
    const option = options.find((item) => item.value === nextValue)
    if (!option || option.disabled) return
    if (!controlled) setUncontrolledValue(nextValue)
    onChange?.(nextValue)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const moveActive = (step: number) => {
    if (!enabledIndexes.length) return
    const currentPosition = Math.max(0, enabledIndexes.indexOf(activeIndex))
    const nextPosition = (currentPosition + step + enabledIndexes.length) % enabledIndexes.length
    focusOption(enabledIndexes[nextPosition])
  }

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu(event.key === 'ArrowDown' ? selectedIndex : enabledIndexes.at(-1) ?? selectedIndex)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) setOpen(false)
      else openMenu()
    }
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusOption(enabledIndexes[0])
    } else if (event.key === 'End') {
      event.preventDefault()
      focusOption(enabledIndexes.at(-1) ?? selectedIndex)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(options[activeIndex]?.value)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  return <div ref={containerRef} className={`ui-dropdown ${open ? 'is-open' : ''} ${className}`.trim()}>
    {name && <input type="hidden" name={name} value={selectedValue} />}
    <button ref={triggerRef} type="button" className="ui-dropdown-trigger" aria-label={ariaLabel} aria-controls={listId} aria-expanded={open} aria-haspopup="listbox" disabled={disabled} onClick={() => open ? setOpen(false) : openMenu()} onKeyDown={onTriggerKeyDown}>
      <span>{selectedOption ? displayLabel(selectedOption.label) : 'Chưa chọn'}</span><ChevronIcon />
    </button>
    {open && <div id={listId} className="ui-dropdown-menu" role="listbox" aria-label={ariaLabel} onKeyDown={onListKeyDown}>
      {options.map((option, index) => <Fragment key={option.value}>
        {option.group && options[index - 1]?.group !== option.group && <div className="ui-dropdown-group-label" role="presentation">{option.group}</div>}
        <button ref={(element) => { optionRefs.current[index] = element }} type="button" role="option" aria-selected={option.value === selectedValue} className={option.value === selectedValue ? 'is-selected' : ''} disabled={option.disabled} onFocus={() => setActiveIndex(index)} onClick={() => choose(option.value)}>{displayLabel(option.label)}</button>
      </Fragment>)}
    </div>}
  </div>
}
