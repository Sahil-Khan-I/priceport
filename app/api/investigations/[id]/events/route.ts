import { loadInvestigation } from "@/lib/storage/file-store";

export async function GET(request, context) {
  const { id } = await context.params;
  const record = await loadInvestigation(id);
  if (!record) {
    return new Response(JSON.stringify({ error: "Investigation not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const after = url.searchParams.get("after") || "";

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastId = after;
      let closed = false;

      const send = (event, data) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("snapshot", {
        id: record.id,
        status: record.status,
        summary: record.summary,
        jobs: record.jobs,
        events: record.events,
      });

      const timer = setInterval(async () => {
        if (closed) return;
        try {
          const latest = await loadInvestigation(id);
          if (!latest) return;

          const fresh = latest.events.filter((evt) => evt.id > lastId || !lastId);
          // Prefer chronological append order rather than string compare on ids
          const unseen = latest.events.filter(
            (evt) => !lastId || latest.events.findIndex((e) => e.id === lastId) < latest.events.findIndex((e) => e.id === evt.id),
          );

          const toSend = lastId
            ? latest.events.slice(
                latest.events.findIndex((e) => e.id === lastId) + 1,
              )
            : latest.events;

          for (const evt of toSend) {
            send("event", evt);
            lastId = evt.id;
          }

          send("status", {
            status: latest.status,
            updatedAt: latest.updatedAt,
            finalizedAt: latest.finalizedAt || null,
            summary: latest.summary,
            jobs: latest.jobs.map((job) => ({
              id: job.id,
              status: job.status,
              streamingUrl: job.streamingUrl,
              tinyfishRunId: job.tinyfishRunId,
              error: job.error,
              offer: job.offer,
            })),
          });

          if (["completed", "failed", "partial", "cancelled"].includes(latest.status)) {
            send("done", { status: latest.status });
            clearInterval(timer);
            closed = true;
            controller.close();
          }

          // silence unused
          void fresh;
          void unseen;
        } catch (error) {
          send("error", {
            message: error instanceof Error ? error.message : "stream error",
          });
        }
      }, 1500);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
