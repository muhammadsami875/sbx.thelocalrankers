-- ═══════════════════════════════════════════════════════════════════════════
--  Create a Super Admin directly in SQL (Neon SQL Editor / psql)
--
--  Use this only if you can't run `npm run db:bootstrap`. The script is safer:
--  the Neon SQL Editor stores query history, so the plaintext password below
--  will persist there until you clear it.
--
--  Assumes `prisma migrate deploy` has already created the tables.
--
--  REPLACE the two values marked >>> CHANGE ME <<< before running.
-- ═══════════════════════════════════════════════════════════════════════════

-- bcrypt support. Produces $2a$ hashes, which bcryptjs verifies.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "User" (
    "id",
    "email",
    "name",
    "passwordHash",
    "role",
    "status",
    "emailVerified",
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid()::text,
    lower('you@thelocalrankers.com'),          -- >>> CHANGE ME <<<
    'Super Admin',
    crypt('ReplaceThisPassword123!', gen_salt('bf', 12)),  -- >>> CHANGE ME <<<
    'SUPER_ADMIN',
    'ACTIVE',
    now(),          -- pre-verified so no email gate blocks first sign-in
    now(),
    now()           -- updatedAt is NOT NULL with no default; must be supplied
)
-- Re-running resets the password and re-asserts admin rights instead of erroring.
ON CONFLICT ("email") DO UPDATE SET
    "passwordHash"  = EXCLUDED."passwordHash",
    "role"          = 'SUPER_ADMIN',
    "status"        = 'ACTIVE',
    "emailVerified" = now(),
    "deletedAt"     = NULL,   -- undo a soft delete, which would block sign-in
    "updatedAt"     = now();

-- Confirm. passwordHash is never selected in full.
SELECT
    "email",
    "role",
    "status",
    "deletedAt",
    left("passwordHash", 7) AS hash_prefix,   -- expect $2a$12$
    "emailVerified" IS NOT NULL AS verified
FROM "User"
ORDER BY "createdAt" DESC;
