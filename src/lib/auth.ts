import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
    },
  },

  // Block user creation if email is not in the whitelist table
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const entry = await prisma.whitelistedEmail.findUnique({
            where: { email: user.email },
          });
          if (!entry) {
            // Returning false aborts creation and BetterAuth returns an error
            return false;
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
