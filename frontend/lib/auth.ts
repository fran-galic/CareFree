import GoogleProvider from "next-auth/providers/google"
import type { JWT } from "next-auth/jwt"
import type { AuthOptions } from "next-auth"

type AuthAccount = {
  access_token?: string
}

type AuthUser = {
  id?: string
}

type AuthSession = {
  user: {
    id?: string
  }
  accessToken?: string
}

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const nextAuthGoogleEnabled = process.env.NEXTAUTH_GOOGLE_ENABLED === "true"

const providers =
  nextAuthGoogleEnabled && googleClientId && googleClientSecret
    ? [
        GoogleProvider({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      ]
    : []

export const authOptions: AuthOptions = {
  providers,
  callbacks: {
    async jwt({ token, account, user }: { token: JWT; account?: AuthAccount | null; user?: AuthUser }) {
      if (account) {
        token.accessToken = account.access_token
      }
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }: { session: AuthSession; token: JWT }) {
      if (token) {
        session.user.id = token.id as string
        session.accessToken = token.accessToken as string
      }
      return session
    },
  },
}
