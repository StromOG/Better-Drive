import { useState, useRef, useEffect, useId, type ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  description?: string
  icon?: ReactNode
  badge?: ReactNode
  colorDot?: string
  colorDots?: string[]
  disabled?: boolean
}

export interface SelectGroup {
  label: string
  options: SelectOption[]
}

export type SelectItem = SelectOption | SelectGroup

function isGroup(item: SelectItem): item is SelectGroup {
  return 'options' in item && Array.isArray((item as SelectGroup).options)
}

export interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  items?: SelectItem[]
  options?: SelectOption[]
  placeholder?: string
  className?: string
  triggerClassName?: string
  menuClassName?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  'aria-label'?: string
}

export function CustomSelect({
  value,
  onChange,
  items,
  options,
  placeholder = 'Select...',
  className,
  triggerClassName,
  menuClassName,
  size = 'md',
  disabled = false,
  'aria-label': ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const id = useId()

  // Normalize items to unified list
  const normalizedItems: SelectItem[] = items ?? (options ? options : [])

  // Flatten all selectable options for lookup and selection
  const flatOptions: SelectOption[] = normalizedItems.flatMap((item) =>
    isGroup(item) ? item.options : [item]
  )

  const selectedOption = flatOptions.find((opt) => opt.value === value)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const sizeClasses = {
    sm: 'h-9 px-3 text-xs rounded-xl',
    md: 'h-11 px-3.5 text-sm rounded-xl',
    lg: 'h-12 px-4 text-base rounded-2xl',
  }[size]

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-block w-full text-left select-none', className)}
    >
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center justify-between gap-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--app-text)] font-bold transition-all outline-none',
          'focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring-focus)]',
          'hover:border-slate-400/60 dark:hover:border-slate-500/60',
          disabled && 'cursor-not-allowed opacity-50',
          sizeClasses,
          triggerClassName
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selectedOption?.icon}
          {selectedOption?.colorDots && selectedOption.colorDots.length > 0 && (
            <span className="flex shrink-0 items-center -space-x-1">
              {selectedOption.colorDots.slice(0, 3).map((color, idx) => (
                <span
                  key={idx}
                  className="h-2.5 w-2.5 rounded-full border border-black/20 dark:border-white/20 shadow-2xs"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
          )}
          {selectedOption?.colorDot && (
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-black/20"
              style={{ backgroundColor: selectedOption.colorDot }}
            />
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : <span className="font-normal text-[var(--app-text-muted)]">{placeholder}</span>}
          </span>
          {selectedOption?.badge}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--app-text-muted)] transition-transform duration-200',
            isOpen && 'rotate-180 text-[var(--accent)]'
          )}
        />
      </button>

      {/* Flyout Custom Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-labelledby={id}
          className={cn(
            'absolute left-0 top-full z-50 mt-1.5 min-w-[200px] w-full max-h-72 overflow-y-auto overflow-x-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1.5 shadow-2xl shadow-black/40 backdrop-blur-2xl transition-all',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            menuClassName
          )}
        >
          {normalizedItems.map((item, groupIndex) => {
            if (isGroup(item)) {
              return (
                <div key={item.label || groupIndex} className="py-1">
                  {/* Group Header */}
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--app-text-muted)]">
                    {item.label}
                  </div>
                  {/* Group Options */}
                  <div className="space-y-0.5">
                    {item.options.map((opt) => renderOption(opt))}
                  </div>
                  {groupIndex < normalizedItems.length - 1 && (
                    <div className="my-1 h-px bg-[var(--card-border)] opacity-60" />
                  )}
                </div>
              )
            }
            return renderOption(item)
          })}
        </div>
      )}
    </div>
  )

  function renderOption(opt: SelectOption) {
    const isSelected = opt.value === value
    return (
      <button
        key={opt.value}
        type="button"
        role="option"
        aria-selected={isSelected}
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!opt.disabled) {
            onChange(opt.value)
            setIsOpen(false)
          }
        }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!opt.disabled) {
            onChange(opt.value)
            setIsOpen(false)
          }
        }}
        className={cn(
          'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer',
          isSelected
            ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-extrabold'
            : 'text-[var(--app-text)] font-semibold hover:bg-black/5 dark:hover:bg-white/10',
          opt.disabled && 'cursor-not-allowed opacity-40',
          size === 'sm' ? 'text-xs py-1.5' : 'text-sm'
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {opt.icon}
          {opt.colorDots && opt.colorDots.length > 0 && (
            <span className="flex shrink-0 items-center -space-x-1">
              {opt.colorDots.slice(0, 3).map((color, idx) => (
                <span
                  key={idx}
                  className="h-3 w-3 rounded-full border border-black/20 dark:border-white/20 shadow-2xs"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
          )}
          {opt.colorDot && (
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-black/20"
              style={{ backgroundColor: opt.colorDot }}
            />
          )}
          <span className="truncate">{opt.label}</span>
          {opt.description && (
            <span className="text-[11px] font-normal text-[var(--app-text-muted)] truncate">
              {opt.description}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {opt.badge}
          {isSelected && <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />}
        </span>
      </button>
    )
  }
}
