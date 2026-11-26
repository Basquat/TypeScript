import { useState, type FormEvent } from "react";
import { errorMessage } from "../api";
import { useAuth } from "../auth";
import Icon, { type IconName } from "../components/Icon";
import { BrandMark } from "./Layout";

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "send", title: "Agenda com confirmação", text: "O cliente pede um horário livre; o psicólogo confirma com um clique." },
  { icon: "lock", title: "Anotações criptografadas", text: "AES-256-GCM no banco. Nem o administrador lê o prontuário." },
  { icon: "shield", title: "Auditoria imutável", text: "Toda ação relevante vira registro que ninguém altera ou apaga." },
];

// Contas fictícias criadas pelo `npm run seed`, para a apresentação.
const DEMO = [
  { label: "Admin", email: "admin@demo.com", password: "admin123" },
  { label: "Psicóloga", email: "psicologo@demo.com", password: "psicologo123" },
  { label: "Cliente", email: "cliente@demo.com", password: "cliente123" },
];

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [tipo, setTipo] = useState<"psicologo" | "cliente">("psicologo");
  const [name, setName] = useState("");
  const [crp, setCrp] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(() =>
      isLogin
        ? login(email, password)
        : register(
            tipo === "psicologo"
              ? { tipo, name, email, password, crp, areaAtuacao: area || undefined }
              : { tipo, name, email, password, phone: phone || undefined },
          ),
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="orbit" aria-hidden="true"><i /><i /><i /></div>
        <div className="brand"><BrandMark /> PsicoGest</div>
        <div>
          <p className="eyebrow">Gestão para profissionais de Psicologia</p>
          <h1 style={{ marginTop: 12 }}>
            Sua prática clínica, <span className="grad-text">em órbita.</span>
          </h1>
          <p className="lead">
            Pacientes, agenda, prontuário e pedidos de consulta num só painel — com controle de acesso por perfil e
            rastreabilidade de ponta a ponta.
          </p>
        </div>
        <div className="features">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature">
              <span className="stat-icon"><Icon name={f.icon} size={16} /></span>
              <div><strong>{f.title}</strong><span>{f.text}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="auth-side">
        <div className="auth-card">
          <div className="segmented" role="tablist" aria-label="Acesso">
            <button type="button" role="tab" aria-selected={isLogin} className={isLogin ? "on" : undefined} onClick={() => { setMode("login"); setError(""); }}>Entrar</button>
            <button type="button" role="tab" aria-selected={!isLogin} className={!isLogin ? "on" : undefined} onClick={() => { setMode("register"); setError(""); }}>Criar conta</button>
          </div>

          <div>
            <h2 style={{ fontSize: "1.6rem" }}>{isLogin ? "Bem-vindo de volta" : "Crie sua conta"}</h2>
            <p className="muted small" style={{ marginTop: 6 }}>
              {isLogin ? "Entre com seu e-mail e senha." : "Psicólogos gerenciam a clínica; clientes encontram um profissional e pedem horário."}
            </p>
          </div>

          <form onSubmit={submit} className="card form">
            {!isLogin && (
              <>
                <div className="segmented" role="radiogroup" aria-label="Tipo de conta">
                  {(["psicologo", "cliente"] as const).map((t) => (
                    <label key={t} className={tipo === t ? "on" : undefined}>
                      <input type="radio" name="tipo" checked={tipo === t} onChange={() => setTipo(t)} />
                      {t === "psicologo" ? "Sou psicólogo(a)" : "Busco atendimento"}
                    </label>
                  ))}
                </div>
                <label>
                  Nome completo
                  <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                </label>
                {tipo === "psicologo" ? (
                  <div className="row">
                    <label>
                      CRP
                      <input value={crp} onChange={(e) => setCrp(e.target.value)} placeholder="03/12345" required />
                    </label>
                    <label>
                      Área de atuação
                      <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Psicologia clínica" maxLength={120} />
                    </label>
                  </div>
                ) : (
                  <label>
                    Telefone (opcional)
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(71) 90000-0000" autoComplete="tel" />
                  </label>
                )}
              </>
            )}
            <label>
              E-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isLogin ? undefined : 8}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              {!isLogin && <span className="hint">Mínimo de 8 caracteres. Guardada só como hash bcrypt.</span>}
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="btn primary block" disabled={busy}>
              {busy ? "Aguarde…" : isLogin ? "Entrar" : "Criar conta"}
            </button>
          </form>

          {isLogin && (
            <div className="demo">
              <span className="muted small">Demonstração:</span>
              {DEMO.map((d) => (
                <button key={d.label} type="button" className="btn sm" disabled={busy} onClick={() => void run(() => login(d.email, d.password))}>
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
