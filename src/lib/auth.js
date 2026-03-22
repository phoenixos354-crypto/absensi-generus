import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { readSheet, appendRow, SHEETS, generateId } from '@/lib/sheets';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      try {
        // Cek apakah user sudah ada di sheet
        const users = await readSheet(SHEETS.USERS);
        const existing = users.find(u => u.email === user.email);
        if (!existing) {
          // Daftarkan user baru
          await appendRow(SHEETS.USERS, [
            generateId(),
            user.email,
            user.name,
            user.image || '',
            new Date().toISOString(),
          ]);
        }
        return true;
      } catch (e) {
        console.error('signIn error', e);
        return false;
      }
    },
    async session({ session }) {
      // Tambahkan user_id dari sheet ke session
      try {
        const users = await readSheet(SHEETS.USERS);
        const dbUser = users.find(u => u.email === session.user.email);
        if (dbUser) {
          session.user.id = dbUser.id;
        }
      } catch (e) {
        console.error('session error', e);
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
