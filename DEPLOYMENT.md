# 🚀 Panduan Deploy Bot 24/7

Panduan lengkap untuk deploy bot ke Vercel agar berjalan 24/7 tanpa maintenance.

## 📋 Checklist Pre-Deploy

- [ ] Node.js 18+ terinstall
- [ ] Git terinstall
- [ ] Akun GitHub
- [ ] Akun Supabase (gratis)
- [ ] Akun Vercel (gratis)
- [ ] Bot token dari platform pilihan

## 🗄️ Setup Database Supabase

### 1. Buat Project Supabase

1. Buka [supabase.com](https://supabase.com)
2. Sign up/Login dengan GitHub
3. Klik "New Project"
4. Pilih organization dan isi:
   - **Name**: `24-hours-bot`
   - **Database Password**: (buat password kuat)
   - **Region**: pilih yang terdekat
5. Klik "Create new project"
6. Tunggu ~2 menit hingga project ready

### 2. Setup Database Schema

1. Di dashboard Supabase, buka **SQL Editor**
2. Klik "New query"
3. Copy-paste isi file `lib/database-schema.sql`
4. Klik "Run" untuk execute SQL
5. Verifikasi tabel `bot_messages` dan `bot_stats` terbuat di **Table Editor**

### 3. Dapatkan API Keys

1. Buka **Settings** > **API**
2. Copy nilai berikut:
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **anon public** key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - **service_role** key (SUPABASE_SERVICE_ROLE_KEY)

## 🔧 Setup Project Local

### 1. Prepare Environment

```bash
# Clone atau download project
cd "24 HOURS BOT"

# Install dependencies
npm install

# Copy environment file
copy .env.example .env.local
```

### 2. Konfigurasi Environment Variables

Edit `.env.local`:

```env
# Dari Supabase Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Bot configuration
BOT_TOKEN=your_telegram_bot_token_here
WEBHOOK_SECRET=random_secret_string_123
CRON_SECRET=another_random_secret_456
```

### 3. Test Local

```bash
# Jalankan development server
npm run dev

# Test endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/stats
```

## 🌐 Deploy ke Vercel

### 1. Push ke GitHub

```bash
# Initialize git (jika belum)
git init
git add .
git commit -m "Initial bot setup"

# Buat repository di GitHub, lalu:
git remote add origin https://github.com/username/24-hours-bot.git
git branch -M main
git push -u origin main
```

### 2. Deploy di Vercel

1. Buka [vercel.com](https://vercel.com)
2. Sign up/Login dengan GitHub
3. Klik "New Project"
4. Import repository `24-hours-bot`
5. **Framework Preset**: Next.js (auto-detected)
6. **Root Directory**: `./` (default)
7. Klik "Deploy"

### 3. Setup Environment Variables di Vercel

1. Setelah deploy, buka project dashboard
2. Klik **Settings** > **Environment Variables**
3. Tambahkan satu per satu:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | https://xxxxx.supabase.co | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | eyJhbGciOiJIUzI1... | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | eyJhbGciOiJIUzI1... | Production |
| `BOT_TOKEN` | your_bot_token | Production |
| `WEBHOOK_SECRET` | random_secret_123 | Production |
| `CRON_SECRET` | another_secret_456 | Production |

4. Klik "Save" untuk setiap variable
5. Klik **Deployments** > **Redeploy** untuk apply changes

## 🔗 Setup Webhook Bot

### Telegram Bot

```bash
# Set webhook URL
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.vercel.app/api/webhook",
    "secret_token": "your_webhook_secret_here"
  }'

# Verify webhook
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

### Discord Bot

1. Buka [Discord Developer Portal](https://discord.com/developers/applications)
2. Pilih bot application
3. **Settings** > **Bot** > **Interactions Endpoint URL**:
   ```
   https://your-app.vercel.app/api/webhook
   ```

### WhatsApp Business API

Setup webhook di WhatsApp Business API dashboard:
```
Webhook URL: https://your-app.vercel.app/api/webhook
Verify Token: your_webhook_secret_here
```

## ✅ Verifikasi Deployment

### 1. Test Endpoints

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Stats
curl https://your-app.vercel.app/api/stats

# Webhook test
curl -X POST https://your-app.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your_webhook_secret" \
  -d '{
    "user_id": "test123",
    "message": "Hello bot!"
  }'
```

### 2. Cek Dashboard

1. Buka `https://your-app.vercel.app`
2. Verifikasi status bot online
3. Cek koneksi database
4. Monitor statistik

### 3. Test Bot

Kirim pesan ke bot:
- `/help` - Lihat bantuan
- `/status` - Status bot
- `/stats` - Statistik
- `Halo` - Test respons

## 🔄 Monitoring & Maintenance

### Vercel Dashboard

- **Functions**: Monitor API calls dan errors
- **Analytics**: Traffic dan performance
- **Deployments**: History dan logs

### Supabase Dashboard

- **Table Editor**: Lihat data messages dan stats
- **Logs**: Database queries dan errors
- **API**: Monitor API usage

### Cron Jobs

Vercel otomatis menjalankan `/api/cron` setiap 5 menit untuk:
- Update bot stats
- Keep functions warm
- Health monitoring

## 🚨 Troubleshooting

### Bot tidak merespons

1. **Cek webhook**:
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

2. **Cek logs Vercel**:
   - Buka Vercel dashboard
   - **Functions** > **View Function Logs**

3. **Cek environment variables**:
   - Settings > Environment Variables
   - Pastikan semua ada dan benar

### Database errors

1. **Test koneksi**:
   ```bash
   curl https://your-app.vercel.app/api/stats
   ```

2. **Cek Supabase**:
   - Dashboard > Settings > API
   - Pastikan project aktif
   - Cek RLS policies

### Webhook tidak berfungsi

1. **Verifikasi URL dan secret**
2. **Test manual**:
   ```bash
   curl -X POST https://your-app.vercel.app/api/webhook \
     -H "x-webhook-secret: your_secret" \
     -d '{"user_id":"test","message":"test"}'
   ```

## 🎉 Selesai!

Bot Anda sekarang berjalan 24/7 di Vercel dengan:
- ✅ Auto-scaling serverless functions
- ✅ Persistent database di Supabase  
- ✅ Automated cron jobs
- ✅ Real-time monitoring dashboard
- ✅ Zero maintenance required

**URL Bot**: `https://your-app.vercel.app`
**Webhook**: `https://your-app.vercel.app/api/webhook`

Bot akan terus berjalan tanpa perlu `npm run` atau server manual! 🚀