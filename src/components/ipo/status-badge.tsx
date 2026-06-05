import { Badge } from "@/components/ui/badge";

const statusConfig = {
  upcoming: { label: "Upcoming", variant: "warning" as const },
  priced: { label: "Priced", variant: "secondary" as const },
  listed: { label: "Listed", variant: "success" as const },
  withdrawn: { label: "Withdrawn", variant: "danger" as const },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] ?? {
    label: status,
    variant: "outline" as const,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
