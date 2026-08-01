import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      clientId: string | null;
      mfaEnabled: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    clientId?: string | null;
    mfaEnabled?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    clientId: string | null;
    mfaEnabled: boolean;
  }
}

export {};
