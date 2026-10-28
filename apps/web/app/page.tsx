"use client";
import { useEffect, useState } from "react";
import type { User } from "@nexo/contracts";
import { api } from "../lib/api";
import { Logo } from "../components/shared";
import { Login } from "../components/login";
import { EmployeeChat } from "../components/employee-chat";
import { AnalystConsole } from "../components/analyst-console";
export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(true);
  useEffect(() => {
    api<{ user: User; agentConfigured: boolean }>("/auth/me")
      .then((data) => {
        setUser(data.user);
        setConfigured(data.agentConfigured);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  async function logout() {
    try {
      await api("/auth/logout", "POST");
      setUser(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (loading)
    return (
      <main className="loading">
        <Logo />
        <p>Carregando seu atendimento…</p>
      </main>
    );
  if (!user)
    return (
      <Login
        onLogin={async (value) => {
          setUser(value);
          const data = await api<{ agentConfigured: boolean }>("/auth/me");
          setConfigured(data.agentConfigured);
        }}
      />
    );
  if (user.role === "analyst")
    return <AnalystConsole user={user} onLogout={logout} />;
  return (
    <EmployeeChat
      user={user}
      configured={configured}
      onLogout={logout}
      globalError={error}
    />
  );
}
