import GoogleProvider from "next-auth/providers/google"

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

export const authOptions: any = {
  providers,
  callbacks: {
    async jwt({ token, account, user }: { token: any; account?: { access_token?: string } | null; user?: { id?: string } }) {
      if (account) {
        token.accessToken = account.access_token
      }
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      session.accessToken = token.accessToken as string
      return session
    },
  },
}
