/**
 * Creates a single Super Admin and nothing else.
 *
 * Use this on a production database instead of `db:seed` — the seed inserts 25
 * fake clients and ~300 fake invoices, which you do not want in a real book.
 *
 * Simplest usage — run it and answer the prompts. The password is read with
 * echo disabled, so it never appears on screen or in your shell history:
 *
 *     npm run db:bootstrap
 *
 * For non-interactive use (CI), set the variables instead:
 *
 *     ADMIN_EMAIL=you@thelocalrankers.com ADMIN_PASSWORD='…' npm run db:bootstrap
 *
 * ADMIN_NAME is optional and defaults to "Super Admin".
 *
 * Idempotent: re-running promotes the account to SUPER_ADMIN and resets the
 * password to whatever ADMIN_PASSWORD currently holds. Nothing else is touched.
 */
import readline from "node:readline";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MIN_PASSWORD_LENGTH = 12;

/**
 * Reads a line from the terminal without echoing it, so the password never
 * appears on screen, in shell history, or in an environment variable.
 */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;

    if (!input.isTTY) {
      reject(new Error("Not a TTY — set ADMIN_PASSWORD instead."));
      return;
    }

    const rl = readline.createInterface({ input, output, terminal: true });

    // Swallow the echoed characters while the prompt is active.
    let muted = false;
    const realWrite = output.write.bind(output);
    (output as NodeJS.WriteStream & { write: typeof realWrite }).write = ((
      chunk: string | Uint8Array,
      ...rest: unknown[]
    ) => {
      if (muted && typeof chunk === "string") {
        // Let control sequences through so backspace still behaves.
        if (!/[\r\n]/.test(chunk)) return true;
      }
      return (realWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof realWrite;

    output.write(question);
    muted = true;

    rl.question("", (answer) => {
      muted = false;
      output.write = realWrite;
      output.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

/** Redacts everything but the first character and the domain. */
function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local![0]}${"*".repeat(Math.max(1, local!.length - 1))}@${domain}`;
}

async function main() {
  let email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  let password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Super Admin";

  // Fall back to interactive prompts so the script is usable without setting
  // any environment variables at all.
  if (!email && process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    email = await new Promise<string>((resolve) =>
      rl.question("  Admin email: ", (a) => {
        rl.close();
        resolve(a);
      }),
    );
    email = email.trim().toLowerCase();
  }

  if (!email) fail("ADMIN_EMAIL is not set and no terminal is available to prompt.");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail(`ADMIN_EMAIL is not a valid email address: ${email}`);
  }

  if (!password) {
    if (!process.stdin.isTTY) {
      fail("ADMIN_PASSWORD is not set and no terminal is available to prompt.");
    }
    password = await promptHidden("  Password (hidden): ");
    const confirm = await promptHidden("  Confirm password: ");
    if (password !== confirm) fail("Passwords did not match.");
  }

  if (!password) fail("No password provided.");

  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(
      `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters (got ${password.length}).`,
    );
  }

  // Catch the most common footgun: pasting the demo password into production.
  if (password === "LocalRankers!2026") {
    fail(
      "ADMIN_PASSWORD is the public demo password from the README. Choose a different one.",
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, deletedAt: true },
  });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      // Set so the account isn't stuck behind an unverified-email gate.
      emailVerified: new Date(),
    },
    update: {
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerified: new Date(),
      // Undo a previous soft delete, otherwise sign-in still fails.
      deletedAt: null,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: existing ? "UPDATE" : "CREATE",
      entity: "User",
      entityId: user.id,
      summary: existing
        ? `bootstrap: reset password and ensured SUPER_ADMIN for ${maskEmail(email)}`
        : `bootstrap: created SUPER_ADMIN ${maskEmail(email)}`,
    },
  });

  const totalUsers = await prisma.user.count();

  console.log(
    existing
      ? `\n  ✓ Updated existing account — password reset, role set to SUPER_ADMIN.`
      : `\n  ✓ Created Super Admin.`,
  );
  console.log(`      email : ${user.email}`);
  console.log(`      name  : ${user.name}`);
  console.log(`      role  : ${user.role}`);
  console.log(`\n  Users in database: ${totalUsers}`);

  if (existing && existing.deletedAt) {
    console.log("  Note: this account was archived and has been restored.");
  }

  console.log(
    "\n  Sign in at /login. Clear ADMIN_PASSWORD from your shell now.\n",
  );
}

main()
  .catch((e) => {
    console.error("\n  ✗ Bootstrap failed:\n", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
