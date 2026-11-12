"use client";
import { useMemo, useRef, useState } from "react";
import { parseFile, type ParsedFile } from "@/lib/parse";
import {
  MESES,
  SEGMENTS,
  SLIDE_LABELS,
  SLIDE_ORDER,
  type DashboardState,
  type ListaSource,
  type MesMeta,
} from "@/lib/types";
import { buildView, fmt, fmtSigned } from "@/lib/view";

type Kind = "relatorio" | "nac" | "integral";

const DROP_INFO: Record<Kind, { title: string; desc: string }> = {
  relatorio: {
    title: "Relatório de Rematrícula",
    desc: "Relatório de Acompanhamento de Rematrícula (.xls) — gera Captação e Rematrícula",
  },
  nac: { title: "Relação de Alunos · NAC", desc: "Relação de Alunos_NAC (.xls)" },
  integral: { title: "Relação de Alunos · Integral", desc: "Relação de Alunos_Integral (.xls)" },
};

function NumField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  allowEmpty,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  hint?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") onChange(allowEmpty ? null : 0);
          else onChange(Number(raw));
        }}
      />
      {hint && <small>{hint}</small>}
    </div>
  );
}

const fmtDateTime = (iso?: string) =>
  iso && new Date(iso).getTime() > 0 ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

export default function AdminPanel({ initial }: { initial: DashboardState }) {
  const [s, setS] = useState<DashboardState>(initial);
  const [saved, setSaved] = useState<string>(JSON.stringify(initial));
  const [msg, setMsg] = useState<{ text: string; type?: "ok" | "err" }>({ text: "" });
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const inputs = { relatorio: useRef<HTMLInputElement>(null), nac: useRef<HTMLInputElement>(null), integral: useRef<HTMLInputElement>(null) };
  const bigInput = useRef<HTMLInputElement>(null);

  const view = useMemo(() => buildView(s), [s]);
  const dirty = JSON.stringify(s) !== saved;

  const update = (fn: (d: DashboardState) => void) =>
    setS((cur) => {
      const next = structuredClone(cur);
      fn(next);
      return next;
    });

  function apply(p: ParsedFile) {
    update((d) => {
      if (p.kind === "relatorio") {
        d.sources.relatorio = p.data;
        if (p.data.emitidoEm) d.dataAte = p.data.emitidoEm;
      } else d.sources[p.kind] = p.data;
    });
  }

  async function handleFiles(files: FileList | File[], hint?: Kind) {
    const list = Array.from(files);
    if (!list.length) return;
    setMsg({ text: "Lendo planilha(s)…" });
    const done: string[] = [];
    try {
      for (const f of list) {
        const p = await parseFile(f, hint === "nac" || hint === "integral" ? hint : undefined);
        const wrong = hint === "relatorio" ? p.kind !== "relatorio" : !!hint && p.kind === "relatorio";
        if (wrong && hint) {
          throw new Error(`"${f.name}" não parece ser um ${DROP_INFO[hint].title}.`);
        }
        apply(p);
        done.push(`${DROP_INFO[p.kind].title}`);
      }
      setMsg({ text: `Importado: ${done.join(", ")}. Confira os números e clique em "Publicar na TV".`, type: "ok" });
    } catch (e) {
      setMsg({ text: (e as Error).message, type: "err" });
    }
  }

  async function save() {
    setBusy(true);
    setMsg({ text: "Publicando…" });
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const body = await res.json().catch(() => ({ error: `Erro ${res.status} do servidor` }));
      if (!res.ok) throw new Error(body.error ?? "Erro ao salvar");
      setS(body);
      setSaved(JSON.stringify(body));
      setMsg({ text: "Publicado! A TV atualiza em até 1 minuto.", type: "ok" });
    } catch (e) {
      setMsg({ text: (e as Error).message, type: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  const setMes = (i: number, patch: Partial<MesMeta>) =>
    update((d) => {
      d.metas.mensal[i] = { ...d.metas.mensal[i], ...patch };
    });

  const addMes = () =>
    update((d) => {
      const last = d.metas.mensal[d.metas.mensal.length - 1];
      let y = 2026,
        m = 8;
      if (last) {
        [y, m] = last.key.split("-").map(Number);
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
      d.metas.mensal.push({ key: `${y}-${String(m).padStart(2, "0")}`, label: MESES[m - 1], meta: 0 });
    });

  const rel = s.sources.relatorio;
  const totalMetaMensal = s.metas.mensal.reduce((a, b) => a + (b.meta || 0), 0);

  const dropCard = (kind: Kind) => {
    const src = s.sources[kind];
    const info = DROP_INFO[kind];
    let n: string | null = null;
    let sub = info.desc;
    if (src) {
      if (kind === "relatorio" && rel) {
        n = `${fmt(rel.captacao)} novos · ${fmt(rel.rematricula)} rem.`;
      } else {
        const l = src as ListaSource;
        n = `${fmt(l.inscricoes)} inscrições · ${fmt(l.alunos)} alunos`;
      }
      sub = `${src.fileName} — importado em ${fmtDateTime(src.importedAt)}`;
    }
    return (
      <div
        key={kind}
        className={`drop ${src ? "ok" : ""} ${over === kind ? "over" : ""}`}
        onClick={() => inputs[kind].current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(kind);
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(null);
          handleFiles(e.dataTransfer.files, kind);
        }}
      >
        <div className="t">{info.title}</div>
        {n && <div className="n" style={{ fontSize: 18 }}>{n}</div>}
        <div className="s">{sub}</div>
        <div className="s" style={{ color: "#4372b6", fontWeight: 600 }}>
          {src ? "Clique para substituir" : "Clique ou arraste o arquivo"}
        </div>
        <input
          ref={inputs[kind]}
          type="file"
          accept=".xls,.xlsx,.csv"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files, kind);
            e.target.value = "";
          }}
        />
      </div>
    );
  };

  const pv = (label: string, color: string, a: number, m: number) => (
    <div className="pv" style={{ background: color, color: color === "#FFC000" ? "#0b1f4d" : "#fff" }}>
      <div className="l">{label}</div>
      <div className="v">{fmt(a)}</div>
      <div className="m">
        Meta {fmt(m)} · {m ? Math.round((a / m) * 100) : 0}% · {fmtSigned(a - m)}
      </div>
    </div>
  );

  return (
    <div className="admin">
      <header className="admin-top">
        <img src="/logo.png" alt="" />
        <h1>Painel de Matrículas · Administração</h1>
        <a className="btn ghost" href="/" target="_blank" rel="noreferrer">
          Abrir TV ↗
        </a>
        <button className="btn ghost" onClick={logout}>
          Sair
        </button>
      </header>

      <main className="admin-main">
        {/* ------------------- Upload ------------------- */}
        <section className="card">
          <h2>1. Enviar planilhas</h2>
          <p className="hint">
            As planilhas são lidas aqui no seu navegador. Apenas os totais (números) são enviados ao servidor —
            nenhum nome, telefone ou e-mail de aluno sai do seu computador.
          </p>
          <div className="drops">{(["relatorio", "nac", "integral"] as Kind[]).map(dropCard)}</div>
          <div
            className={`bigdrop ${over === "all" ? "over" : ""}`}
            onClick={() => bigInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver("all");
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              handleFiles(e.dataTransfer.files);
            }}
          >
            …ou arraste <strong>todas as planilhas de uma vez</strong> aqui (o sistema identifica cada uma).
            <input
              ref={bigInput}
              type="file"
              multiple
              accept=".xls,.xlsx,.csv"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </section>

        {/* ------------------- Prévia ------------------- */}
        <section className="card">
          <h2>2. Conferir números</h2>
          <p className="hint">É isto que aparecerá na TV depois de publicar.</p>
          <div className="preview-grid">
            {pv("Captação", "#003660", view.captacao.atual, view.captacao.meta)}
            {pv("Rematrícula", "#7660AE", view.rematricula.atual, view.rematricula.meta)}
            {pv("Total MAT + REM", "#FFC000", view.total.atual, view.total.meta)}
            {pv("NAC", "#E36C0A", view.nac.atual, view.nac.meta)}
            {pv("Integral", "#31849B", view.integral.atual, view.integral.meta)}
          </div>
          {rel && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginTop: 18 }}>
              <div>
                <strong>Captação por mês</strong>
                <table className="unit-table">
                  <tbody>
                    {view.mensal.map((m) => (
                      <tr key={m.label}>
                        <td>{m.label}</td>
                        <td>
                          {fmt(m.atual)} / {fmt(m.meta)}
                        </td>
                        <td>{Math.round(m.pct * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <strong>Rematrícula por segmento</strong>
                <table className="unit-table">
                  <tbody>
                    {view.segmentos.map((m) => (
                      <tr key={m.label}>
                        <td>{m.label}</td>
                        <td>
                          {fmt(m.atual)} / {fmt(m.meta)}
                        </td>
                        <td>{Math.round(m.pct * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <strong>Por unidade</strong>
                <table className="unit-table">
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Novos</th>
                      <th>Rem.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(rel.porUnidade).map(([u, v]) => (
                      <tr key={u}>
                        <td>{u}</td>
                        <td>{fmt(v.captacao)}</td>
                        <td>{fmt(v.rematricula)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ------------------- Metas ------------------- */}
        <section className="card">
          <h2>3. Metas e configurações</h2>
          <p className="hint">Ajuste as metas (compromissos) e como os números são calculados.</p>
          <div className="form-grid">
            <div className="section-title">Geral</div>
            <NumField label="Ano da campanha" value={s.ano} onChange={(v) => update((d) => void (d.ano = v ?? d.ano))} />
            <NumField
              label="Ano de comparação"
              value={s.anoAnterior}
              onChange={(v) => update((d) => void (d.anoAnterior = v ?? d.anoAnterior))}
            />
            <div className="field">
              <label>Dados coletados até</label>
              <input type="date" value={s.dataAte} onChange={(e) => update((d) => void (d.dataAte = e.target.value))} />
              <small>Preenchido com a data de emissão do relatório</small>
            </div>
            <NumField
              label="Segundos por slide"
              value={s.settings.slideSeconds}
              onChange={(v) => update((d) => void (d.settings.slideSeconds = Math.max(5, v ?? 14)))}
            />

            <div className="section-title">Metas (nosso compromisso)</div>
            <NumField
              label="Captação"
              value={s.metas.captacao}
              onChange={(v) => update((d) => void (d.metas.captacao = v ?? 0))}
              hint={`Soma das metas mensais: ${fmt(totalMetaMensal)}`}
            />
            <NumField
              label="Rematrícula"
              value={s.metas.rematricula}
              onChange={(v) => update((d) => void (d.metas.rematricula = v ?? 0))}
            />
            <NumField label="NAC" value={s.metas.nac} onChange={(v) => update((d) => void (d.metas.nac = v ?? 0))} />
            <NumField
              label="Integral"
              value={s.metas.integral}
              onChange={(v) => update((d) => void (d.metas.integral = v ?? 0))}
            />
            {SEGMENTS.map((seg) => (
              <NumField
                key={seg.key}
                label={`Rematrícula · ${seg.label}`}
                value={s.metas.segmentos[seg.key]}
                onChange={(v) => update((d) => void (d.metas.segmentos[seg.key] = v ?? 0))}
              />
            ))}

            <div className="section-title">Comparativo</div>
            <NumField
              label={`Captação ${s.anoAnterior} (mesmo período)`}
              value={s.captacaoAnoAnterior}
              onChange={(v) => update((d) => void (d.captacaoAnoAnterior = v ?? 0))}
            />

            <div className="section-title">Forma de contagem</div>
            <div className="field">
              <label>NAC conta</label>
              <select
                value={s.contagemNac}
                onChange={(e) => update((d) => void (d.contagemNac = e.target.value as "inscricoes" | "alunos"))}
              >
                <option value="inscricoes">Inscrições (cada atividade)</option>
                <option value="alunos">Alunos únicos</option>
              </select>
            </div>
            <div className="field">
              <label>Integral conta</label>
              <select
                value={s.contagemIntegral}
                onChange={(e) => update((d) => void (d.contagemIntegral = e.target.value as "inscricoes" | "alunos"))}
              >
                <option value="inscricoes">Inscrições</option>
                <option value="alunos">Alunos únicos</option>
              </select>
            </div>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Captação mensal</label>
              <select
                value={s.mensalModo}
                onChange={(e) => update((d) => void (d.mensalModo = e.target.value as "acumulado" | "mensal"))}
              >
                <option value="acumulado">Acumulado — excedente de meses encerrados passa para o próximo</option>
                <option value="mensal">Mês a mês — conta só as matrículas feitas no mês</option>
              </select>
              <small>Matrículas anteriores ao 1º mês contam no 1º mês.</small>
            </div>

            <div className="section-title">Valores manuais (opcional)</div>
            <NumField
              label="Captação — já temos"
              value={s.overrides.captacao}
              allowEmpty
              placeholder={`Planilha: ${fmt(rel?.captacao ?? 0)}`}
              onChange={(v) => update((d) => void (d.overrides.captacao = v))}
            />
            <NumField
              label="Rematrícula — já temos"
              value={s.overrides.rematricula}
              allowEmpty
              placeholder={`Planilha: ${fmt(rel?.rematricula ?? 0)}`}
              onChange={(v) => update((d) => void (d.overrides.rematricula = v))}
            />
            <NumField
              label="NAC — já temos"
              value={s.overrides.nac}
              allowEmpty
              placeholder={`Planilha: ${fmt(s.sources.nac?.[s.contagemNac] ?? 0)}`}
              onChange={(v) => update((d) => void (d.overrides.nac = v))}
            />
            <NumField
              label="Integral — já temos"
              value={s.overrides.integral}
              allowEmpty
              placeholder={`Planilha: ${fmt(s.sources.integral?.[s.contagemIntegral] ?? 0)}`}
              onChange={(v) => update((d) => void (d.overrides.integral = v))}
              hint="Deixe vazio para usar a planilha"
            />
          </div>
        </section>

        <section className="card">
          <h2>Metas mensais de captação</h2>
          <p className="hint">Um mês por linha, na ordem em que aparecem no gráfico.</p>
          <div className="months">
            <div className="month-row" style={{ fontWeight: 600, fontSize: 13, color: "#3b4559" }}>
              <span>Mês (aaaa-mm)</span>
              <span>Rótulo</span>
              <span>Meta</span>
              <span>Matr. no mês</span>
              <span />
            </div>
            {s.metas.mensal.map((m, i) => (
              <div className="month-row" key={i}>
                <input type="month" value={m.key} onChange={(e) => setMes(i, { key: e.target.value })} />
                <input value={m.label} onChange={(e) => setMes(i, { label: e.target.value })} />
                <input
                  type="number"
                  value={m.meta}
                  onChange={(e) => setMes(i, { meta: Number(e.target.value || 0) })}
                />
                <span style={{ textAlign: "center" }}>{fmt(rel?.captacaoPorMes[m.key] ?? 0)}</span>
                <button
                  className="btn small"
                  title="Remover"
                  onClick={() => update((d) => void d.metas.mensal.splice(i, 1))}
                >
                  ✕
                </button>
              </div>
            ))}
            <div>
              <button className="btn small" onClick={addMes}>
                + Adicionar mês
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Slides exibidos</h2>
          <div className="chk-grid">
            {SLIDE_ORDER.map((k) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={s.settings.slides[k] !== false}
                  onChange={(e) => update((d) => void (d.settings.slides[k] = e.target.checked))}
                />
                {SLIDE_LABELS[k]}
              </label>
            ))}
          </div>
        </section>
      </main>

      <div className="savebar">
        <span className={`msg ${msg.type ?? ""}`}>
          {msg.text ||
            (dirty
              ? "Há alterações não publicadas."
              : `Última publicação: ${fmtDateTime(s.updatedAt) || "nunca"}`)}
        </span>
        {dirty && (
          <button className="btn" onClick={() => setS(JSON.parse(saved))} disabled={busy}>
            Descartar
          </button>
        )}
        <button className="btn primary" onClick={save} disabled={busy}>
          {busy ? "Publicando…" : "Publicar na TV"}
        </button>
      </div>
    </div>
  );
}
