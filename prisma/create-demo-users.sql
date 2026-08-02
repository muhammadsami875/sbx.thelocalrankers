-- ═══════════════════════════════════════════════════════════════════════════
--  Create all 12 demo users in one statement.
--
--  Password for every account: LocalRankers!2026
--
--  ⚠ This password is published in README.md. Only use this on a sandbox
--    deployment. Never on a database holding real client data.
--
--  Assumes the tables already exist (prisma migrate deploy).
--  Safe to re-run: existing emails have their password and role reset.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "User" (
    "id", "email", "name", "passwordHash",
    "role", "status", "jobTitle",
    "emailVerified", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    lower(u.email),
    u.name,
    -- Called per row, so each account gets its own salt.
    crypt('LocalRankers!2026', gen_salt('bf', 12)),
    u.role::"UserRole",
    'ACTIVE'::"UserStatus",
    u.title,
    now(),   -- pre-verified: no email gate on first sign-in
    now(),
    now()    -- updatedAt is NOT NULL with no default
FROM (VALUES
    ('tom@thelocalrankers.com',     'Tom Lyne',        'SUPER_ADMIN',       'Founder'),
    ('dana@thelocalrankers.com',    'Dana Whitfield',  'AGENCY_MANAGER',    'Agency Manager'),
    ('marcus@thelocalrankers.com',  'Marcus Reed',     'MARKETING_MANAGER', 'Marketing Manager'),
    ('priya@thelocalrankers.com',   'Priya Nair',      'SEO_TEAM',          'Senior SEO Strategist'),
    ('alex@thelocalrankers.com',    'Alex Contreras',  'GOOGLE_ADS_TEAM',   'Paid Search Lead'),
    ('jordan@thelocalrankers.com',  'Jordan Blake',    'SOCIAL_MEDIA_TEAM', 'Social Media Manager'),
    ('sam@thelocalrankers.com',     'Sam Okafor',      'DEVELOPER',         'Web Developer'),
    ('elena@thelocalrankers.com',   'Elena Vasquez',   'DESIGNER',          'Brand Designer'),
    ('riley@thelocalrankers.com',   'Riley Chen',      'CONTENT_WRITER',    'Content Writer'),
    ('nina@thelocalrankers.com',    'Nina Patel',      'ACCOUNTANT',        'Accountant'),
    ('chris@thelocalrankers.com',   'Chris Doyle',     'READ_ONLY',         'Advisor'),
    ('client1@example.com',         'Client Portal',   'CLIENT',            'Client')
) AS u(email, name, role, title)
ON CONFLICT ("email") DO UPDATE SET
    "passwordHash"  = EXCLUDED."passwordHash",
    "role"          = EXCLUDED."role",
    "status"        = 'ACTIVE',
    "emailVerified" = now(),
    "deletedAt"     = NULL,   -- a soft-deleted user cannot sign in
    "updatedAt"     = now();

-- Attach the CLIENT user to a client record if one exists, so the portal has
-- data to show. Harmless no-op while the Client table is empty.
UPDATE "User"
SET "clientId" = (SELECT "id" FROM "Client" WHERE "deletedAt" IS NULL
                  ORDER BY "createdAt" LIMIT 1),
    "updatedAt" = now()
WHERE "email" = 'client1@example.com';

-- Verify
SELECT "email", "role", "status", "clientId",
       left("passwordHash", 7) AS hash_prefix
FROM "User"
ORDER BY "role", "email";
