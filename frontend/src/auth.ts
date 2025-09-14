import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: process.env.NODE_ENV === 'production', // Enable debug in production temporarily
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  trustHost: true,
  basePath: "/api/auth",
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account }) {
      console.log('🔍 SignIn callback triggered:', {
        userEmail: user.email,
        provider: account?.provider,
        clientId: process.env.GOOGLE_CLIENT_ID?.slice(0, 10) + '...',
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
      });
      
      // Only allow specific email addresses
      const allowedEmails = process.env.ALLOWED_EMAILS?.split(',') || [
        'joyce.yan.zhang@gmail.com',
        'sheridan.gray@gmail.com'
      ];
      
      console.log('📧 Allowed emails:', allowedEmails);
      console.log('✅ Access granted:', allowedEmails.includes(user.email || ''));
      
      return allowedEmails.includes(user.email || '');
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});