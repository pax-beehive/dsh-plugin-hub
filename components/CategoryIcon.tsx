import {
  Bot,
  BrainCircuit,
  Gauge,
  Image,
  MessagesSquare,
  Palette,
  Search,
  ShieldCheck,
  Workflow,
  Wrench,
} from "lucide-react";

type CategoryIconComponent = typeof Bot;

const categoryIcons: Record<string, CategoryIconComponent> = {
  "agents-orchestration": Bot,
  "memory-context": BrainCircuit,
  "developer-tools": Wrench,
  "ui-customization": Palette,
  "integrations-communication": MessagesSquare,
  "vision-media": Image,
  "search-research": Search,
  "security-access": ShieldCheck,
  "models-usage": Gauge,
  "productivity-workflow": Workflow,
};

export default function CategoryIcon({ category }: { category: string }) {
  const Icon = categoryIcons[category] ?? Workflow;

  return (
    <span className="category-directory-mark" data-category={category} aria-hidden="true">
      <Icon />
    </span>
  );
}
