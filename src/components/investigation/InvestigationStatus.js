import Badge from "@/components/ui/Badge";
import { formatStatusLabel } from "@/lib/utils";

const toneByStatus = {
  queued: "muted",
  starting: "accent",
  navigating: "accent",
  searching: "lavender",
  extracting: "accent",
  verifying: "warn",
  completed: "success",
  failed: "coral",
  timed_out: "coral",
  unsupported: "warn",
};

export default function InvestigationStatus({ status }) {
  return (
    <Badge tone={toneByStatus[status] || "muted"}>
      {formatStatusLabel(status)}
    </Badge>
  );
}
