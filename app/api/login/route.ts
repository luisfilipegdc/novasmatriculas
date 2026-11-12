import { NextResponse } from "next/server";
import { adminConfigured, checkPassword, COOKIE, createSessionValue, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Defina a variável ADMIN_PASSWORD nas configurações do projeto." },
      { status: 500 },
    );
  }
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, createSessionValue(), sessionCookieOptions);
  return res;
}
