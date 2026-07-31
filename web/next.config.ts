import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // تصدير ثابت: `pnpm build` يُخرج مجلد out/ يُستضاف على أي خدمة ملفات ثابتة (GitHub Pages، Netlify…)
  output: "export",
  // على GitHub Pages يكون التطبيق تحت /calendar — يُضبط من سير النشر
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
}

export default nextConfig
