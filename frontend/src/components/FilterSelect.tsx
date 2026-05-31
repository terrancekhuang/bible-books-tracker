export default function FilterSelect({
  value, onChange, placeholder, options, theme,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[] | { value: string; label: string }[];
  theme?: 'light' | 'dark';
}) {
  const active = value !== '';
  const isDark = theme === 'dark'

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-xs px-2 py-1.5 rounded-lg cursor-pointer outline-none transition-all"
      style={{
        fontFamily: "'Raleway', sans-serif",
        background: active
          ? (isDark ? 'rgba(150,175,255,0.2)' : 'rgba(13,21,51,0.1)')
          : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.45)'),
        border: active
          ? (isDark ? '1px solid rgba(170,195,255,0.35)' : '1px solid rgba(13,21,51,0.28)')
          : (isDark ? '1px solid rgba(150,175,255,0.12)' : '1px solid rgba(13,21,51,0.1)'),
        color: active
          ? (isDark ? '#dde6ff' : '#0d1533')
          : (isDark ? 'rgba(195,210,255,0.5)' : 'rgba(13,21,51,0.45)'),
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
