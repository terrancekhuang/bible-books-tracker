const primaryText = 'var(--color-ink)'

export default function FilterSelect({
  value, onChange, placeholder, options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[] | { value: string; label: string }[];
}) {
  const active = value !== '';

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-xs px-2 py-1.5 rounded-lg cursor-pointer outline-none transition-all"
      style={{
        background: active ? 'rgba(35,31,26,0.1)' : 'rgba(255,255,255,0.45)',
        border: active ? '1px solid rgba(35,31,26,0.28)' : '1px solid rgba(35,31,26,0.1)',
        color: active ? primaryText : 'rgba(35,31,26,0.45)',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o =>
        typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  );
}
