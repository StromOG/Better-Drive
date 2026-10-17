import { useState, useRef, useEffect } from 'react'
import {
  X,
  Upload,
  Check,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Image as ImageIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PRESET_AVATARS } from '@/data/presetAvatars'
import {
  validateAvatarFile,
  createSquareAvatarDataUrl,
  type AvatarValidationResult,
  MIN_AVATAR_DIMENSION,
  MAX_AVATAR_DIMENSION
} from '@/lib/avatarGuards'
import { updateStoredUser, getStoredUser, type AuthUser } from '@/lib/auth'
import { apiFetch } from '@/lib/api'

interface AvatarPickerModalProps {
  isOpen: boolean
  onClose: () => void
  user: AuthUser | null
  currentAvatarUrl?: string
  onAvatarChanged: (newUrl: string) => void
}

export function AvatarPickerModal({
  isOpen,
  onClose,
  user,
  currentAvatarUrl,
  onAvatarChanged
}: AvatarPickerModalProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentAvatarUrl || '')
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets')
  const [presetCategory, setPresetCategory] = useState<'all' | 'mascot' | 'cyber' | 'retro' | 'abstract'>('all')

  // Custom upload states
  const [dragOver, setDragOver] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<AvatarValidationResult | null>(null)
  const [customDataUrl, setCustomDataUrl] = useState<string>('')
  const [autoCropSquare, setAutoCropSquare] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedAvatar(currentAvatarUrl || '')
      setValidationResult(null)
      setCustomDataUrl('')
    }
  }, [isOpen, currentAvatarUrl])

  if (!isOpen) return null

  const filteredPresets = PRESET_AVATARS.filter((avatar) => {
    if (presetCategory === 'all') return true
    return avatar.category === presetCategory
  })

  async function handleFileSelect(file: File) {
    setValidating(true)
    setValidationResult(null)
    try {
      const result = await validateAvatarFile(file)
      setValidationResult(result)
      if (result.valid && result.dataUrl) {
        let finalUrl = result.dataUrl
        if (autoCropSquare && result.meta.type !== 'image/svg+xml') {
          try {
            finalUrl = await createSquareAvatarDataUrl(result.dataUrl, 256)
          } catch {
            finalUrl = result.dataUrl
          }
        }
        setCustomDataUrl(finalUrl)
        setSelectedAvatar(finalUrl)
      }
    } catch {
      setValidationResult({
        valid: false,
        error: 'An unexpected error occurred while validating the image.',
        meta: {
          name: file.name,
          sizeBytes: file.size,
          sizeFormatted: `${Math.round(file.size / 1024)} KB`,
          type: file.type || 'unknown'
        }
      })
    } finally {
      setValidating(false)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  async function handleSave() {
    const currentUser = user || getStoredUser()
    if (!currentUser) return
    setSaving(true)
    try {
      const newUrl = selectedAvatar
      const updatedUser: AuthUser = {
        ...currentUser,
        avatarUrl: newUrl || undefined
      }
      updateStoredUser(updatedUser)
      onAvatarChanged(newUrl)

      // Persist to backend mascot settings and user profile for cross-device/cross-session sync
      apiFetch('/mascot/settings', {
        method: 'PUT',
        body: JSON.stringify({ avatarUrl: newUrl || '' }),
      }).catch(() => {})

      apiFetch('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ avatarUrl: newUrl || '' }),
      }).catch(() => {})

      onClose()
    } finally {
      setSaving(false)
    }
  }

  function handleResetToDefault() {
    setSelectedAvatar('')
    setCustomDataUrl('')
    setValidationResult(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto overflow-x-hidden">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-[var(--card-border)] bg-[var(--app-bg)] shadow-2xl text-[var(--app-text)] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] px-6 py-4 bg-[var(--card-bg)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-[var(--app-text)]">
                Choose Account Avatar
              </h2>
              <p className="text-xs font-semibold text-[var(--app-text-muted)]">
                Select a curated companion avatar or upload a custom logo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-2 text-[var(--app-text-muted)] hover:bg-[var(--app-border)] hover:text-[var(--app-text)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Preview Strip */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] bg-[var(--card-bg)]/50 px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="relative">
              {selectedAvatar ? (
                <img
                  src={selectedAvatar}
                  alt="Avatar preview"
                  className="h-14 w-14 rounded-2xl border-2 border-blue-500 object-cover shadow-md bg-[var(--card-bg)]"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-md border border-blue-400/20">
                  {(user?.name ?? user?.email ?? 'U').trim().charAt(0).toUpperCase()}
                </div>
              )}
              {selectedAvatar && (
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-muted)]">
                Preview Selection
              </p>
              <p className="text-sm font-extrabold text-[var(--app-text)]">
                {selectedAvatar
                  ? selectedAvatar.startsWith('data:image/svg+xml')
                    ? 'Curated Vector Preset'
                    : 'Custom Image / Logo'
                  : 'Default (Initials / Gravatar)'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-medium text-[var(--app-text-muted)]">
                  Sidebar preview:
                </span>
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--card-border)] overflow-hidden bg-slate-800 text-[10px] text-white font-bold">
                  {selectedAvatar ? (
                    <img src={selectedAvatar} alt="sidebar" className="h-full w-full object-cover" />
                  ) : (
                    (user?.name ?? 'U').charAt(0).toUpperCase()
                  )}
                </div>
              </div>
            </div>
          </div>

          {selectedAvatar && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              className="text-xs font-bold gap-1.5 border-[var(--card-border)] text-[var(--app-text-muted)] hover:text-red-500"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Default
            </Button>
          )}
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-[var(--card-border)] px-6 pt-2 gap-4 bg-[var(--app-bg)]">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`pb-3 text-sm font-extrabold transition-colors border-b-2 ${
              activeTab === 'presets'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
            }`}
          >
            Curated Presets ({PRESET_AVATARS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`pb-3 text-sm font-extrabold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'custom'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload Custom Logo
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-6 space-y-4">
          {activeTab === 'presets' ? (
            <div>
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pb-4">
                {(
                  [
                    { id: 'all', label: 'All Avatars' },
                    { id: 'mascot', label: 'Mascots' },
                    { id: 'cyber', label: 'Space & Cyber' },
                    { id: 'retro', label: 'Retro' },
                    { id: 'abstract', label: 'Geometric' }
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setPresetCategory(cat.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      presetCategory === cat.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-[var(--card-bg)] text-[var(--app-text-muted)] border border-[var(--card-border)] hover:text-[var(--app-text)]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredPresets.map((avatar) => {
                  const isSelected = selectedAvatar === avatar.dataUri
                  return (
                    <div
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.dataUri)}
                      className={`group relative flex flex-col items-center rounded-2xl border p-3 text-center cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-500/10 shadow-md ring-2 ring-blue-500/30'
                          : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-blue-400/50 hover:shadow-xs'
                      }`}
                    >
                      {/* Avatar Image */}
                      <div className="relative mb-2.5 h-16 w-16 sm:h-20 sm:w-20 transition-transform group-hover:scale-105">
                        <img
                          src={avatar.dataUri}
                          alt={avatar.name}
                          className="h-full w-full rounded-2xl object-contain drop-shadow-sm"
                        />
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <p className="w-full truncate text-xs font-black text-[var(--app-text)]">
                        {avatar.name}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-[var(--app-text-muted)]">
                        {avatar.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Security & Format Guard Guidelines Card */}
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--app-text)]">
                    Upload Specifications & Validation Guards
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2">
                    <p className="text-[10px] font-bold uppercase text-[var(--app-text-muted)]">
                      Max Size
                    </p>
                    <p className="text-xs font-black text-[var(--app-text)]">2.0 MB</p>
                  </div>
                  <div className="rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2">
                    <p className="text-[10px] font-bold uppercase text-[var(--app-text-muted)]">
                      Allowed Formats
                    </p>
                    <p className="text-xs font-black text-[var(--app-text)]">
                      PNG, JPG, WebP, SVG, GIF
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2">
                    <p className="text-[10px] font-bold uppercase text-[var(--app-text-muted)]">
                      Resolution
                    </p>
                    <p className="text-xs font-black text-[var(--app-text)]">
                      {MIN_AVATAR_DIMENSION}px to {MAX_AVATAR_DIMENSION}px
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-2">
                    <p className="text-[10px] font-bold uppercase text-[var(--app-text-muted)]">
                      Aspect Ratio
                    </p>
                    <p className="text-xs font-black text-[var(--app-text)]">
                      1:1 Square (Auto-fit)
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-blue-400 hover:bg-[var(--card-bg)]/80'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Upload className="h-6 w-6" />
                </div>

                <p className="text-sm font-extrabold text-[var(--app-text)]">
                  Click to select or drag and drop an image
                </p>
                <p className="text-xs font-semibold text-[var(--app-text-muted)] mt-1">
                  PNG, JPG, WebP, SVG, or GIF (max 2.0 MB)
                </p>

                {validating && (
                  <p className="mt-3 text-xs font-bold text-blue-500 animate-pulse">
                    Validating file guards & dimensions...
                  </p>
                )}
              </div>

              {/* Validation Result / Guard Feedback */}
              {validationResult && (
                <div
                  className={`rounded-xl border p-4 transition-all ${
                    validationResult.valid
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                      : 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {validationResult.valid ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider">
                          {validationResult.valid
                            ? 'File Passed All Security & Dimension Guards'
                            : 'Guard Check Failed'}
                        </span>
                        <span className="text-xs font-bold opacity-80">
                          {validationResult.meta.name}
                        </span>
                      </div>

                      {validationResult.error && (
                        <p className="text-xs font-bold text-red-600 dark:text-red-400">
                          {validationResult.error}
                        </p>
                      )}

                      {validationResult.warning && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 pt-0.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>{validationResult.warning}</span>
                        </div>
                      )}

                      {/* File Metadata Badges */}
                      <div className="flex flex-wrap gap-2 pt-1.5 text-[11px] font-bold">
                        <span className="rounded-md bg-black/10 dark:bg-white/10 px-2 py-0.5">
                          Size: {validationResult.meta.sizeFormatted}
                        </span>
                        <span className="rounded-md bg-black/10 dark:bg-white/10 px-2 py-0.5">
                          Format: {validationResult.meta.type}
                        </span>
                        {validationResult.meta.width && validationResult.meta.height && (
                          <span className="rounded-md bg-black/10 dark:bg-white/10 px-2 py-0.5">
                            Dimensions: {validationResult.meta.width} ×{' '}
                            {validationResult.meta.height} px
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Square Cropping Preference */}
              {customDataUrl && (
                <div className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-[var(--app-text-muted)]" />
                    <div>
                      <p className="text-xs font-extrabold text-[var(--app-text)]">
                        Square Auto-Fit (1:1 Ratio)
                      </p>
                      <p className="text-[11px] font-semibold text-[var(--app-text-muted)]">
                        Automatically centers and crops non-square uploads to prevent distortion
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoCropSquare}
                    onChange={(e) => setAutoCropSquare(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--card-border)] bg-[var(--card-bg)] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-bold border-[var(--card-border)]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || validating || (validationResult !== null && !validationResult.valid)}
            className="text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-5"
          >
            {saving ? 'Applying...' : 'Apply Avatar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
