"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { setClientRetainer } from "@/app/(app)/payments/retainer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Click-to-edit monthly retainer.
 *
 * This is the field MRR sums, so saving here moves MRR straight away — no
 * separate subscription step.
 */
export function RetainerCell({
  clientId,
  clientName,
  amount,
  editable,
}: {
  clientId: string;
  clientName: string;
  amount: number;
  editable: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(String(amount || ""));
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Re-sync when the server sends a new value (e.g. after another edit).
  React.useEffect(() => {
    if (!editing) setValue(String(amount || ""));
  }, [amount, editing]);

  async function save() {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Enter an amount of zero or more.");
      return;
    }
    if (next === amount) {
      setEditing(false);
      return;
    }

    setPending(true);
    const result = await setClientRetainer(clientId, next);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${clientName} set to ${formatCurrency(result.amount)}/mo`);
    setEditing(false);
    router.refresh();
  }

  if (!editable) {
    return (
      <span className="tabular text-muted-foreground">
        {amount > 0 ? `${formatCurrency(amount)}/mo` : "—"}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Click to edit the monthly retainer"
        className="group inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-muted"
      >
        <span className="tabular font-medium">
          {amount > 0 ? (
            <>
              {formatCurrency(amount)}
              <span className="text-xs font-normal text-muted-foreground">/mo</span>
            </>
          ) : (
            <span className="text-muted-foreground">Set amount</span>
          )}
        </span>
        <Pencil className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        type="number"
        step="0.01"
        min="0"
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            setValue(String(amount || ""));
            setEditing(false);
          }
        }}
        className="h-8 w-24 px-2 text-sm"
        aria-label={`Monthly retainer for ${clientName}`}
      />
      <Button
        size="icon-sm"
        onClick={save}
        disabled={pending}
        aria-label="Save retainer"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          setValue(String(amount || ""));
          setEditing(false);
        }}
        aria-label="Cancel"
      >
        <X />
      </Button>
    </div>
  );
}
