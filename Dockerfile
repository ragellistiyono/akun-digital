# Image produksi toko (PRD §12, docs/DEPLOY.md), dibangun deploy/deploy.sh di server lewat compose.prod.yml.
# Isinya aplikasi Next.js beserta pekerja latar pg-boss, yang berjalan di proses server yang sama
# (src/instrumentation.ts). Image yang sama dipakai untuk migrasi database (drizzle-kit) dan perintah sekali
# jalan seperti `pnpm admin:buat` (tsx), jadi dependency pengembangan ikut terpasang.
FROM node:22-trixie-slim

ENV NEXT_TELEMETRY_DISABLED=1

# pnpm dengan versi yang sama dengan packageManager di package.json.
COPY package.json /tmp/package.json
RUN npm install --global --no-fund --no-audit \
      "$(node -p "require('/tmp/package.json').packageManager.split('+')[0]")" \
 && rm /tmp/package.json

# Folder unggahan (UPLOAD_DIR) milik pengguna node. Volume unggahan yang baru dibuat ikut memakai pemilik ini.
RUN mkdir -p /app /data/unggahan && chown node:node /app /data/unggahan

# Aplikasi berjalan tanpa hak root.
USER node
WORKDIR /app

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY --chown=node:node . .
# Saat build, Next.js memuat modul halaman: src/server/db menolak dimuat tanpa DATABASE_URL, dan Better Auth
# mencetak galat bila rahasia dan alamatnya kosong. Build tidak membuka database dan tidak memakai rahasia, jadi
# nilai pengganti di bawah cukup. Nilai ini hanya berlaku di langkah build dan tidak tersimpan di image; saat
# berjalan, semuanya diisi compose.prod.yml dari berkas env di server.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=pengganti-saat-build-bukan-rahasia-sungguhan \
    BETTER_AUTH_URL=http://localhost:3000 \
    pnpm build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
