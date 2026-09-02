interface ModulePlaceholderProps {
  readonly name: string;
  readonly description: string;
}

export default function ModulePlaceholder({
  name,
  description,
}: ModulePlaceholderProps) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center bg-surface-0 p-4">
      <div className="w-full max-w-sm rounded-none border border-surface-2 bg-surface-1">
        <p className="border-b border-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-tertiary">
          Module · Standby
        </p>
        <div className="px-4 py-5">
          <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
      </div>
    </section>
  );
}
