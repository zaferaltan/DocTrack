import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { ChevronLeft, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Input } from "@renderer/components/ui/input";
import { cn } from "@renderer/lib/utils";

export interface CommandPaletteItem {
  id: string;
  label: string;
  subtitle?: string;
  group: string;
  icon?: ComponentType<{ className?: string }>;
}

interface CommandPaletteDialogProps {
  open: boolean;
  title: string;
  description: string;
  query: string;
  items: CommandPaletteItem[];
  emptyMessage: string;
  showBackButton: boolean;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onBack: () => void;
  onSelect: (itemId: string) => void;
}

export function CommandPaletteDialog({
  open,
  title,
  description,
  query,
  items,
  emptyMessage,
  showBackButton,
  onOpenChange,
  onQueryChange,
  onBack,
  onSelect,
}: CommandPaletteDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveIndex(0);
  }, [items, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, title]);

  useEffect(() => {
    if (!open || items.length === 0) {
      return;
    }

    const activeItem = itemRefs.current[activeIndex];
    if (activeItem && typeof activeItem.scrollIntoView === "function") {
      activeItem.scrollIntoView({
        block: "nearest",
      });
    }
  }, [activeIndex, items, open]);

  const groupedItems = useMemo(() => {
    const groups: Array<{
      name: string;
      items: Array<CommandPaletteItem & { visibleIndex: number }>;
    }> = [];
    const byName = new Map<string, number>();

    items.forEach((item, index) => {
      const existingIndex = byName.get(item.group);
      if (existingIndex === undefined) {
        byName.set(item.group, groups.length);
        groups.push({
          name: item.group,
          items: [{ ...item, visibleIndex: index }],
        });
        return;
      }

      groups[existingIndex]?.items.push({ ...item, visibleIndex: index });
    });

    return groups;
  }, [items]);

  const handleMove = (direction: 1 | -1) => {
    if (items.length === 0) {
      return;
    }

    setActiveIndex((current) => {
      const nextIndex = current + direction;
      if (nextIndex < 0) {
        return items.length - 1;
      }

      if (nextIndex >= items.length) {
        return 0;
      }

      return nextIndex;
    });
  };

  const handleEscape = () => {
    if (showBackButton) {
      onBack();
      return;
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid h-[min(82vh,40rem)] w-[min(94vw,45rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0"
        showCloseButton={false}
      >
        <div className="border-b border-border px-4 pb-4 pt-3">
          <DialogHeader className="pr-0">
            <div className="flex items-center gap-2">
              {showBackButton ? (
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  aria-label="Back"
                  onClick={onBack}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : null}
              <div>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="mt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                aria-label="Command search"
                className="pl-10"
                placeholder="Type a command..."
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    handleMove(1);
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    handleMove(-1);
                    return;
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    const item = items[activeIndex];
                    if (item) {
                      onSelect(item.id);
                    }
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    handleEscape();
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-2 py-2">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            groupedItems.map((group) => (
              <div key={group.name} className="pb-2">
                <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {group.name}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.visibleIndex === activeIndex;

                    return (
                      <button
                        key={item.id}
                        ref={(element) => {
                          itemRefs.current[item.visibleIndex] = element;
                        }}
                        type="button"
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-accent/70",
                        )}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onMouseEnter={() => {
                          setActiveIndex(item.visibleIndex);
                        }}
                        onClick={() => onSelect(item.id)}
                      >
                        <div
                          className={cn(
                            "mt-0.5 rounded-lg border border-border bg-background p-1.5 text-muted-foreground",
                            isActive && "border-transparent bg-card text-foreground",
                          )}
                        >
                          {Icon ? (
                            <Icon className="h-4 w-4" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {item.label}
                          </div>
                          {item.subtitle ? (
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
