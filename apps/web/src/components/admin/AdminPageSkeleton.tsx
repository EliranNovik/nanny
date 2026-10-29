function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-200/80 dark:bg-zinc-800 ${className}`} />;
}

export function AdminTableSkeleton({
  rows = 10,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white dark:bg-zinc-900">
      <div className="grid gap-5 border-b border-zinc-100 bg-zinc-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-800/60" style={{ gridTemplateColumns: `repeat(${columns}, minmax(80px, 1fr))` }}>
        {Array.from({ length: columns }, (_, index) => <Pulse key={index} className="h-3 w-20" />)}
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="grid gap-5 px-6 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(80px, 1fr))` }}>
            {Array.from({ length: columns }, (_, column) => (
              <Pulse key={column} className={column === 0 ? "h-7 w-28" : "h-4 w-20"} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPageSkeleton({
  summaryCards = 0,
  columns = 6,
}: {
  summaryCards?: number;
  columns?: number;
}) {
  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-6 dark:bg-zinc-950 lg:px-6 xl:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <Pulse className="h-8 w-56" />
          <Pulse className="h-4 w-80 max-w-[70vw]" />
        </div>
        <Pulse className="h-10 w-28" />
      </div>
      {summaryCards > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: summaryCards }, (_, index) => (
            <div key={index} className="rounded-2xl bg-white p-4 dark:bg-zinc-900">
              <Pulse className="mb-4 h-4 w-24" />
              <Pulse className="h-8 w-16" />
            </div>
          ))}
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Pulse key={index} className="h-10 w-full" />)}
      </div>
      <AdminTableSkeleton columns={columns} />
    </div>
  );
}
