import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AnforderungStatus, Prioritaet } from "@/lib/types";
import {
  PRIORITAET_BADGE,
  PRIORITAET_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
} from "@/lib/status";

export function StatusBadge({
  status,
  className,
}: {
  status: AnforderungStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_BADGE[status], className)}
    >
      <span className="size-1.5 rounded-full bg-current opacity-60" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function PrioritaetBadge({ prioritaet }: { prioritaet: Prioritaet }) {
  return (
    <Badge variant="outline" className={cn("font-medium", PRIORITAET_BADGE[prioritaet])}>
      {PRIORITAET_LABEL[prioritaet]}
    </Badge>
  );
}
