import type { ReactElement } from 'react'

export function TextPreview({ content }: { content: string }): ReactElement {
  return (
    <div className="h-full w-full overflow-auto bg-slate-950 p-4 font-mono text-xs text-slate-100 selection:bg-blue-500/30">
      <pre className="whitespace-pre-wrap break-words leading-relaxed select-all">
        <code>{content}</code>
      </pre>
    </div>
  )
}

export const CodePreview = TextPreview
export default TextPreview
