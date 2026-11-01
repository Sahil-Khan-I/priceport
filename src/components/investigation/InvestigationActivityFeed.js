export default function InvestigationActivityFeed({ events = [] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-pp-dark-card p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-white/45">
        Activity feed
      </p>
      <ul className="mt-3 space-y-2.5">
        {events.map((event) => (
          <li
            key={`${event.time}-${event.text}`}
            className="flex gap-3 text-sm text-white/70"
          >
            <span className="w-10 shrink-0 font-mono text-[11px] text-white/35">
              {event.time}
            </span>
            <span>{event.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
