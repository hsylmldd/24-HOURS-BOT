# 24 Hours Bot

Bot yang berjalan 24/7 menggunakan Next.js dan Supabase, di-deploy ke Vercel untuk operasi tanpa henti.

## 🚀 Fitur

- ✅ **24/7 Uptime**: Bot berjalan terus menerus tanpa perlu `npm run` atau `node script`
- ✅ **Serverless**: Menggunakan Vercel untuk auto-scaling dan zero maintenance
- ✅ **Database Persistent**: Supabase untuk penyimpanan data yang reliable
- ✅ **Webhook Support**: Menerima pesan melalui webhook endpoints
- ✅ **Real-time Stats**: Dashboard untuk monitoring status dan statistik bot
- ✅ **Auto Cron Jobs**: Scheduled tasks untuk menjaga bot tetap aktif

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 + TypeScript + React
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Styling**: CSS + Tailwind-ready

## 📋 Prerequisites

1. Node.js 18+ 
2. Akun Supabase
3. Akun Vercel
4. Bot token (Telegram/Discord/WhatsApp/dll)

## 🔧 Setup Local Development

### 1. Clone dan Install Dependencies

```bash
git clone <repository-url>
cd "24 HOURS BOT"
npm install
```

### 2. Setup Supabase Database

1. Buat project baru di [Supabase](https://supabase.com)
2. Jalankan SQL schema dari file `lib/database-schema.sql` di SQL Editor Supabase
3. Dapatkan URL dan API keys dari Settings > API

### 3. Environment Variables

Copy `.env.example` ke `.env.local` dan isi dengan nilai yang sesuai:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Bot Configuration
BOT_TOKEN=your_bot_token_here
WEBHOOK_SECRET=your_webhook_secret_here
CRON_SECRET=your_cron_secret_here
```

### 4. Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) untuk melihat dashboard bot.

## 🚀 Deploy ke Vercel

### 1. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Deploy ke Vercel

1. Buka [Vercel Dashboard](https://vercel.com/dashboard)
2. Import project dari GitHub
3. Set environment variables di Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BOT_TOKEN`
   - `WEBHOOK_SECRET`
   - `CRON_SECRET`

### 3. Setup Webhook

Setelah deploy, dapatkan URL Vercel Anda dan setup webhook di platform bot:

```
https://your-app.vercel.app/api/webhook
```

Header yang diperlukan:
```
x-webhook-secret: your_webhook_secret_here
```

## 📡 API Endpoints

### Webhook
- `POST /api/webhook` - Menerima pesan bot
- `GET /api/webhook` - Status check

### Monitoring
- `GET /api/health` - Health check
- `GET /api/stats` - Statistik bot
- `GET /api/cron` - Cron job endpoint (otomatis dijalankan Vercel)

## 🔄 Cara Kerja 24/7

Bot ini berjalan 24/7 dengan cara:

1. **Serverless Functions**: Setiap API endpoint adalah serverless function yang auto-scale
2. **Vercel Cron Jobs**: Menjalankan `/api/cron` setiap 5 menit untuk keep-alive
3. **Database Persistent**: Supabase menyimpan semua data dan state
4. **Webhook Driven**: Bot merespons event secara real-time melalui webhook

## 📊 Monitoring

Dashboard tersedia di root URL yang menampilkan:
- Status bot (online/offline)
- Koneksi database
- Statistik pesan dan user
- Memory usage dan uptime

## 🤖 Kustomisasi Bot Logic

Edit file `lib/bot-logic.ts` untuk menambah:
- Perintah baru
- Respons kustom
- Integrasi AI/ML
- Logic bisnis spesifik

Contoh menambah perintah baru:

```typescript
if (normalizedMessage.includes('/weather')) {
  return await this.getWeatherResponse(userId)
}
```

## 🔒 Security

- Environment variables untuk semua secrets
- Webhook secret verification
- Row Level Security (RLS) di Supabase
- CORS headers yang aman

## 🐛 Troubleshooting

### Bot tidak merespons
1. Cek `/api/health` endpoint
2. Verifikasi environment variables
3. Cek logs di Vercel dashboard

### Database error
1. Pastikan Supabase project aktif
2. Cek RLS policies
3. Verifikasi service role key

### Webhook tidak berfungsi
1. Cek webhook URL dan secret
2. Verifikasi headers request
3. Test dengan curl atau Postman

## 📝 License

MIT License - silakan gunakan untuk project apapun.

## 🤝 Contributing

1. Fork repository
2. Buat feature branch
3. Commit changes
4. Push ke branch
5. Buat Pull Request

---

**Happy Coding! 🚀**

Bot Anda sekarang berjalan 24/7 tanpa perlu server atau maintenance manual!