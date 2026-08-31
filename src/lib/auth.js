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
      } catch (e) {
        // Jangan blokir login cuma gara-gara gagal simpan ke sheet
        // (mis. Google Sheets lagi rate-limit/lemot sesaat). User tetap
        // boleh masuk; pendaftarannya akan dicoba lagi otomatis di
        // callback session() di bawah kalau ternyata belum tersimpan.
        console.error('signIn: gagal daftarkan user, tetap izinkan login', e);
      }
      return true;
    },
    async session({ session }) {
      // Tambahkan user_id dari sheet ke session
      try {
        let users = await readSheet(SHEETS.USERS);
        let dbUser = users.find(u => u.email === session.user.email);
        if (!dbUser) {
          // Self-healing: mungkin pendaftaran waktu signIn() sempat gagal
          // (gangguan sesaat). Coba daftarkan sekarang supaya user tetap
          // punya user_id yang valid untuk fitur kepemilikan kelompok dll.
          try {
            await appendRow(SHEETS.USERS, [
              generateId(),
              session.user.email,
              session.user.name,
              session.user.image || '',
              new Date().toISOString(),
            ]);
            users = await readSheet(SHEETS.USERS, { skipCache: true });
            dbUser = users.find(u => u.email === session.user.email);
          } catch (e2) {
            console.error('session: gagal self-heal daftar user', e2);
          }
        }
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
