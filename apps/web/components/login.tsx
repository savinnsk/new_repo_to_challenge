"use client";
import { useState } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import type { User } from "@nexo/contracts";
import { api } from "../lib/api";
import { Logo } from "./shared";
export function Login({ onLogin }: { onLogin: (user: User) => Promise<void> }) {
  const [email, setEmail] = useState("ana.souza@nexo.com.br");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="login">
      <section className="login-intro">
        <Logo />
        <div className="intro-copy">
          <p className="eyebrow">Service desk de TI da Nexo</p>
          <h1>Seu problema de TI, resolvido em uma conversa.</h1>
          <p>
            Descreva o que está acontecendo. O assistente consulta seus
            chamados, busca na central de ajuda e chama um analista quando
            precisa.
          </p>
          <div className="sample-chat">
            <div className="sample-user">
              Meu notebook não conecta na VPN. Erro 809.
            </div>
            <small>Nexo Assist · consultou seus chamados</small>
            <div className="sample-assistant">
              Vamos conferir a versão do Windows e o impacto antes de preparar
              seu chamado.
            </div>
            <span className="sample-tag">
              ● Atendimento com contexto, do início ao fim
            </span>
          </div>
        </div>
        <footer className="intro-footer">
          <span>Converse com o assistente</span>
          <span>Confira antes de criar</span>
          <span>Conte com um analista</span>
        </footer>
      </section>
      <section className="login-panel">
        <div className="login-help">Service desk de TI · Nexo</div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const data = await api<{ user: User }>("/auth/login", "POST", {
                email,
                password,
              });
              await onLogin(data.user);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Entrar</h2>
          <p>Use seu e-mail corporativo para iniciar o atendimento.</p>
          <label>
            E-mail corporativo
            <div className="input-icon">
              <Mail size={17} />
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>
          <label>
            Senha
            <div className="input-icon">
              <LockKeyhole size={17} />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Qualquer senha na demonstração"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="primary login-submit" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
            <ArrowRight size={17} />
          </button>
          <div className="demo-note">
            <strong>Ambiente de demonstração</strong>
            <p>Qualquer senha não vazia. Contas disponíveis:</p>
            <button
              type="button"
              className="text-button"
              onClick={() => setEmail("ana.souza@nexo.com.br")}
            >
              Ana · Funcionária
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setEmail("carla.mendes@nexo.com.br")}
            >
              Carla · Funcionária
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setEmail("rafael.lima@nexo.com.br")}
            >
              Rafael · Analista
            </button>
          </div>
        </form>
        <footer>© 2026 Nexo · Service desk de TI</footer>
      </section>
    </main>
  );
}
