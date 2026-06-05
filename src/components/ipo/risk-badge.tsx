import { Badge } from "@/components/ui/badge";

const riskConfig = {
  low: { label: "Low Risk", variant: "success" as const },
  medium: { label: "Medium Risk", variant: "warning" as const },
  high: { label: "High Risk", variant: "danger" as const },
};

export function RiskBadge({ level }: { level: string }) {
  const config = riskConfig[level as keyof typeof riskConfig] ?? {
    label: level,
    variant: "outline" as const,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
