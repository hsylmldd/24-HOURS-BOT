import { BotStatus } from '@/components/BotStatus'
import { BotStats } from '@/components/BotStats'

export default function Home() {
  return (
    <main className="container">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">24 Hours Bot</h1>
        <p className="text-lg text-gray-600">
          Bot yang berjalan 24/7 menggunakan Next.js dan Supabase
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BotStatus />
        <BotStats />
      </div>
      
      <div className="card mt-6">
        <h2 className="text-2xl font-semibold mb-4">Fitur Bot</h2>
        <ul className="space-y-2">
          <li>✅ Berjalan 24/7 tanpa perlu npm run atau node script</li>
          <li>✅ Database Supabase untuk penyimpanan data</li>
          <li>✅ Deploy otomatis ke Vercel</li>
          <li>✅ Webhook untuk menerima pesan</li>
          <li>✅ Auto-scaling dan serverless</li>
        </ul>
      </div>
    </main>
  )
}