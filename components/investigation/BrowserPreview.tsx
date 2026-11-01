export default function BrowserPreview({
  streamingUrl = null,
  label = "Browser preview",
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-white/45">{label}</p>
      {streamingUrl ? (
        <iframe
          title="TinyFish live browser"
          src={streamingUrl}
          className="mt-3 aspect-video w-full rounded-xl border border-white/10 bg-black"
        />
      ) : (
        <p className="mt-3 text-sm text-white/60">
          Live TinyFish streaming URLs will embed here when an investigation is
          running. This page currently shows the product shell.
        </p>
      )}
    </div>
  );
}
