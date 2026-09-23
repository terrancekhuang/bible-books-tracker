export default function ShortcutHint({ action, keys }: { action: string; keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {action}
      {keys.map(k => (
        <kbd
          key={k}
          className="inline-flex items-center justify-center rounded px-1 text-[10px] font-mono min-w-[1.1rem]"
          style={{ background: 'var(--color-shelf-lit)', border: '1px solid rgba(210,166,63,0.3)', color: 'var(--color-leaf)' }}
        >
          {k}
        </kbd>
      ))}
    </span>
  )
}
