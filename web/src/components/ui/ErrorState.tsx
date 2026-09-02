interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-lg font-medium text-red-700 dark:text-red-400">
        Could not load the supply-chain graph
      </p>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Retry
      </button>
    </div>
  );
}
