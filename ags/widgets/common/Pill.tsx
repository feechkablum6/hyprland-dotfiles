export default function Pill({ className, children }: { className?: string; children: JSX.Element | JSX.Element[] }) {
  return <box class={className ? `pill ${className}` : "pill"}>{children}</box>
}
