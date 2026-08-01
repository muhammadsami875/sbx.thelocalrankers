"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { initials, stringToHue } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PortalUserMenu({
  name,
  email,
  image,
  userId,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
  userId: string;
}) {
  const hue = stringToHue(userId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Account menu"
        >
          <Avatar>
            {image && <AvatarImage src={image} alt="" />}
            <AvatarFallback
              style={{
                backgroundColor: `oklch(0.88 0.06 ${hue})`,
                color: `oklch(0.32 0.09 ${hue})`,
              }}
            >
              {initials(name ?? email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="normal-case">
          <p className="truncate text-sm font-semibold text-foreground">
            {name ?? "Client"}
          </p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
