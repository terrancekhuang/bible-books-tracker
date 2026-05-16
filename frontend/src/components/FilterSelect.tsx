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
      className={[
        "text-xs px-2 py-1.5 rounded-lg border cursor-pointer outline-none transition-colors",
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500",
      ].join(" ")}
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
