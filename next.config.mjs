/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      {
        // Atalho curto para baixar o app na TV (app Downloader do Google TV)
        source: "/apk",
        destination:
          "https://github.com/luisfilipegdc/novasmatriculas/releases/latest/download/painel-tv.apk",
        permanent: false,
      },
    ];
  },
};
export default nextConfig;
