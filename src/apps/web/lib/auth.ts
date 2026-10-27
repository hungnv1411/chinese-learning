import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { bearer } from 'better-auth/plugins';
import { userSettings } from '@/db/schema';
import { SESSION_EXPIRES_IN_SEC, SESSION_UPDATE_AGE_SEC, userCreateDefaults } from './auth-defaults';
import { getConfig } from './config';
import { getDb, schema } from './db';

function createAuth() {
  const cfg = getConfig();
  const db = getDb();
  return betterAuth({
    baseURL: cfg.SITE_URL,
    secret: cfg.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    socialProviders: {
      google: { clientId: cfg.GOOGLE_CLIENT_ID, clientSecret: cfg.GOOGLE_CLIENT_SECRET },
    },
    session: { expiresIn: SESSION_EXPIRES_IN_SEC, updateAge: SESSION_UPDATE_AGE_SEC },
    user: {
      additionalFields: {
        displayName: { type: 'string', required: false },
        certificateName: { type: 'string', required: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: { ...user, ...userCreateDefaults(user) } }),
          after: async (user) => {
            await db.insert(userSettings).values({ userId: user.id }).onConflictDoNothing();
          },
        },
      },
    },
    // bearer: app native sau này dùng lại API bằng `Authorization: Bearer`.
    plugins: [bearer(), nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** Tạo khi cần (cấu hình đọc lúc chạy, không đọc lúc build). */
export function getAuth() {
  instance ??= createAuth();
  return instance;
}

/** userId của phiên trong request (cookie hoặc bearer), hoặc null. */
export async function resolveSession(req: Request): Promise<string | null> {
  const session = await getAuth().api.getSession({ headers: req.headers });
  return session?.user.id ?? null;
}
