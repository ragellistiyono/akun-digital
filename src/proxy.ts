import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Semua rute di bawah /admin selain halaman login: tanpa cookie sesi, pengunjung langsung diarahkan
// ke /admin, termasuk untuk alamat yang belum punya halaman (UAT-B2). Pemeriksaan ini hanya melihat
// cookie; masa berlaku sesi diperiksa penuh oleh wajibSesiAdmin di setiap halaman dan aksi.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path+",
};
