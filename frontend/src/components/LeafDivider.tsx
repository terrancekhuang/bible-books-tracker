/** A quiet rule between subsections of a leaf — quieter than the heading's red double rule. */
export default function LeafDivider() {
  return <div aria-hidden style={{ height: 1, margin: '28px 0', background: 'var(--color-leaf-rule)' }} />
}
