"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientFormSheet } from "@/components/clients/client-form-sheet";

/**
 * Edit button for the client detail page.
 *
 * The sheet fetches the full record itself, so the minimal stub passed here is
 * only used to signal "edit mode" and supply the id.
 */
export function ClientDetailActions({
  clientId,
  canUpdate,
}: {
  clientId: string;
  canUpdate: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  if (!canUpdate) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Pencil />
        <span className="hidden sm:inline">Edit client</span>
      </Button>

      {open && (
        <ClientFormSheet
          open={open}
          onOpenChange={setOpen}
          managers={[]}
          allTags={[]}
          clientId={clientId}
        />
      )}
    </>
  );
}
