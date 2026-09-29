import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Prisma/bcrypt) — used by middleware for the
// isLoggedIn check. The Credentials provider itself (which needs Prisma)
// lives only in auth.ts, imported by the Node-runtime API route handler.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
