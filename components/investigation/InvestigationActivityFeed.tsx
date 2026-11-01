type ActivityEvent = {
  time?: string;
  text?: string;
  at?: string;
  message?: string;
  id?: string;
  type?: string;
};

export default function InvestigationActivityFeed({
  events = [],
}: {
  events?: ActivityEvent[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-pp-dark-card p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-white/45">
        Activity feed
      </p>
      <ul className="mt-3 space-y-2.5">
        {events.map((event, index) => {
          const time = event.time || event.at || String(index);
          const text = event.text || event.message || "";
          return (
            <li key={`${time}-${text}-${index}`} className="flex gap-3 text-sm text-white/70">
              <span className="w-10 shrink-0 font-mono text-[11px] text-white/35">
                {time}
              </span>
              <span>{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
