import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Server Action menerima gambar unggahan Admin. Batas gambar sendiri (2 MB) diperiksa di
      // src/server/berkas-unggahan.ts dengan pesan yang jelas; batas ini menyamai batas body proxy
      // (bawaan 10 MB), supaya gambar yang terlalu besar tetap sampai ke pemeriksaan itu.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
