import { useState, useEffect } from 'react'

export function CandyDecorations() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      // Calculate normalized -1 to 1 offset from center
      const x = (e.clientX / window.innerWidth - 0.5) * 20
      const y = (e.clientY / window.innerHeight - 0.5) * 20
      setMousePos({ x, y })
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Arctic Glacier Pastel Gradient Backdrop Sheen */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-200/50 via-[#e8f2ff] to-blue-100/60 dark:from-[#071126] dark:via-[#0e1a38] dark:to-[#050b18]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,rgba(186,230,253,0.55),rgba(232,242,255,0.75)_45%,rgba(252,231,243,0.38)_100%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,rgba(14,165,233,0.18),transparent_70%)]" />

      {/* Floating Candy Orbs with Parallax Effect */}
      {/* Top-Left Arctic Sky Orb */}
      <div
        className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-sky-400/35 via-blue-300/30 to-indigo-200/25 blur-3xl transition-transform duration-700 ease-out dark:from-sky-500/20 dark:to-blue-600/15"
        style={{
          transform: `translate(${mousePos.x * 1.5}px, ${mousePos.y * 1.5}px)`,
        }}
      />

      {/* Top-Right Soft Rose-Frost Orb */}
      <div
        className="absolute top-12 -right-20 h-[420px] w-[420px] rounded-full bg-gradient-to-bl from-pink-300/40 via-rose-300/30 to-sky-200/25 blur-3xl transition-transform duration-700 ease-out dark:from-pink-500/20 dark:to-purple-600/15"
        style={{
          transform: `translate(${-mousePos.x * 1.2}px, ${mousePos.y * 1.2}px)`,
        }}
      />

      {/* Bottom Center Arctic Cobalt Pool */}
      <div
        className="absolute -bottom-32 left-1/2 -translate-x-1/2 h-[450px] w-[620px] rounded-full bg-gradient-to-t from-blue-300/35 via-sky-200/30 to-transparent blur-3xl transition-transform duration-700 ease-out dark:from-sky-900/20 dark:via-blue-900/15"
        style={{
          transform: `translate(calc(-50% + ${mousePos.x * 0.8}px), ${-mousePos.y * 0.8}px)`,
        }}
      />

      {/* Clean high-density grid overlay with subtle pastel tint */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#0284c70a_1px,transparent_1px),linear-gradient(to_bottom,#f43f5e06_1px,transparent_1px)] bg-[size:20px_20px]"
      />
    </div>
  )
}
