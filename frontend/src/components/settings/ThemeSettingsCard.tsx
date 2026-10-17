import { useState } from 'react'
import { Check, ChevronDown, Moon, Palette, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CustomSelect } from '@/components/ui/select'
import { useTheme, APP_THEMES } from '@/lib/theme'
import { getStoredUser } from '@/lib/auth'
import { cn } from '@/lib/utils'

export function ThemeSettingsCard() {
  const user = getStoredUser()
  const { currentTheme, themeConfig, setTheme, toggleMode } = useTheme()
  const [appearanceExpanded, setAppearanceExpanded] = useState(false)

  return (
    <Card className="p-4 sm:p-5 border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-xs">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-black text-[var(--app-text)] leading-tight">Theme & Appearance</h2>
            <p className="text-xs font-semibold text-[var(--app-text-muted)]">Saved to account ({user?.email || 'Current user'})</p>
          </div>
        </div>

        {/* Compact Quick Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Theme Preview Badge */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-[var(--card-border)] bg-black/5 dark:bg-white/5">
            <span className="text-xs font-black text-[var(--app-text)]">{themeConfig.name}</span>
            <div className="flex items-center -space-x-1">
              {themeConfig.palette.previewColors.slice(0, 3).map((c, i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full border border-black/20" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Custom Theme Dropdown Selector */}
          <div className="w-56 sm:w-64">
            <CustomSelect
              value={currentTheme}
              onChange={(val) => setTheme(val)}
              size="sm"
              aria-label="Theme selector"
              items={[
                {
                  label: 'Light Themes',
                  options: APP_THEMES.filter((t) => t.mode === 'light').map((t) => ({
                    value: t.id,
                    label: `${t.name} — ${t.tagline}`,
                    colorDots: t.palette.previewColors,
                  })),
                },
                {
                  label: 'Dark Themes',
                  options: APP_THEMES.filter((t) => t.mode === 'dark').map((t) => ({
                    value: t.id,
                    label: `${t.name} — ${t.tagline}`,
                    colorDots: t.palette.previewColors,
                  })),
                },
              ]}
            />
          </div>

          {/* Light/Dark Mode Switcher */}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={toggleMode}
            className="h-9 px-2.5 text-xs font-bold gap-1.5"
            title={themeConfig.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {themeConfig.mode === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-500" />}
            <span className="capitalize">{themeConfig.mode}</span>
          </Button>

          {/* Collapsible Gallery Toggle */}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setAppearanceExpanded(!appearanceExpanded)}
            className="h-9 px-2.5 text-xs font-bold gap-1 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            title={appearanceExpanded ? 'Collapse theme cards' : 'Show all theme cards'}
          >
            <span>{appearanceExpanded ? 'Hide Gallery' : 'Browse Gallery'}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", appearanceExpanded && "rotate-180")} />
          </Button>
        </div>
      </div>

      {/* Collapsible Visual Theme Cards Grid */}
      {appearanceExpanded && (
        <div className="mt-5 pt-4 border-t border-[var(--card-border)] space-y-4 animate-in fade-in duration-200">
          {/* Light Themes */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--app-text)]">Light Themes</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {APP_THEMES.filter((t) => t.mode === 'light').map((t) => {
                const isCurrent = currentTheme === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onPointerDown={() => setTheme(t.id)}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      'group relative flex flex-col rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer',
                      isCurrent
                        ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 bg-[var(--accent)]/5 shadow-xs'
                        : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-slate-400/50 hover:bg-black/5 dark:hover:bg-white/5'
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <span className="font-black text-xs text-[var(--app-text)]">{t.name}</span>
                      {isCurrent && (
                        <span className="flex items-center gap-0.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          <Check className="h-2.5 w-2.5 stroke-[3]" /> Active
                        </span>
                      )}
                    </div>

                    {/* Miniature Visual Palette Preview Bar */}
                    <div
                      className="w-full h-7 rounded-lg mb-2 flex items-center justify-between px-2.5 border transition-all"
                      style={{ backgroundColor: t.palette.bg, borderColor: t.palette.previewColors[2] }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full shadow-xs" style={{ backgroundColor: t.palette.accent }} />
                        <span className="h-2 w-7 rounded-xs shadow-2xs" style={{ backgroundColor: t.palette.card }} />
                      </div>
                      <div className="flex items-center -space-x-1">
                        {t.palette.previewColors.map((color, idx) => (
                          <span
                            key={idx}
                            className="h-2.5 w-2.5 rounded-full border border-white/20 shadow-xs"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] font-medium text-[var(--app-text-muted)] line-clamp-2 mb-2">
                      {t.description}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-1.5 border-t border-[var(--card-border)]">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">{t.tagline}</span>
                      <div className="flex items-center -space-x-1">
                        {t.palette.previewColors.map((color, idx) => (
                          <span
                            key={idx}
                            className="h-3 w-3 rounded-full border border-black/40 shadow-xs"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dark Themes */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--app-text)]">Dark Themes</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {APP_THEMES.filter((t) => t.mode === 'dark').map((t) => {
                const isCurrent = currentTheme === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onPointerDown={() => setTheme(t.id)}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      'group relative flex flex-col rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer',
                      isCurrent
                        ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 bg-[var(--accent)]/10 shadow-xs'
                        : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-slate-400/50 hover:bg-black/5 dark:hover:bg-white/5'
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <span className="font-black text-xs text-[var(--app-text)]">{t.name}</span>
                      {isCurrent && (
                        <span className="flex items-center gap-0.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          <Check className="h-2.5 w-2.5 stroke-[3]" /> Active
                        </span>
                      )}
                    </div>

                    {/* Miniature Visual Palette Preview Bar */}
                    <div
                      className="w-full h-7 rounded-lg mb-2 flex items-center justify-between px-2.5 border transition-all"
                      style={{ backgroundColor: t.palette.bg, borderColor: t.palette.previewColors[2] }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full shadow-xs" style={{ backgroundColor: t.palette.accent }} />
                        <span className="h-2 w-7 rounded-xs shadow-2xs" style={{ backgroundColor: t.palette.card }} />
                      </div>
                      <div className="flex items-center -space-x-1">
                        {t.palette.previewColors.map((color, idx) => (
                          <span
                            key={idx}
                            className="h-2.5 w-2.5 rounded-full border border-white/20 shadow-xs"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] font-medium text-[var(--app-text-muted)] line-clamp-2 mb-2">
                      {t.description}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-1.5 border-t border-[var(--card-border)]">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">{t.tagline}</span>
                      <div className="flex items-center -space-x-1">
                        {t.palette.previewColors.map((color, idx) => (
                          <span
                            key={idx}
                            className="h-3 w-3 rounded-full border border-black/40 shadow-xs"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
