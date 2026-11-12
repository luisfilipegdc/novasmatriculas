"use client";
import { useState } from "react";

export default function Login({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    configured ? "" : "ADMIN_PASSWORD não configurada no servidor (veja o README).",
  );
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) window.location.reload();
    else setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Erro ao entrar");
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <img src="/logo.png" alt="Colégio Marista" />
        <h1>Painel de Matrículas · Admin</h1>
        <div className="field">
          <label htmlFor="pw">Senha</label>
          <input
            id="pw"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <div className="err">{error}</div>}
        <button className="btn primary" disabled={loading || !configured}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
