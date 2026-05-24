import { FormEvent, useState } from 'react';
import {
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiMoon,
  FiSun,
} from 'react-icons/fi';
import { AuthUser, ThemePreference } from '../types';
import OctopusViz from './OctopusViz';

interface Props {
  apiBase: string;
  logoUrl: string;
  theme: ThemePreference;
  onThemeToggle: () => void;
  onAuthenticated: (user: AuthUser) => void;
}

interface LoginResponse {
  user: AuthUser;
  expires_at: string;
}

export default function LoginScreen({
  apiBase,
  logoUrl,
  theme,
  onThemeToggle,
  onAuthenticated,
}: Props) {
  const [email, setEmail] = useState('test@mail.com');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          remember,
        }),
      });

      if (!response.ok) {
        setError(
          response.status === 401
            ? 'Credenciales inválidas. Revisa el correo y la contraseña.'
            : `No se pudo iniciar sesión (${response.status}).`
        );
        return;
      }

      const data = (await response.json()) as LoginResponse;
      onAuthenticated(data.user);
    } catch {
      setError('No se pudo conectar con la API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-form-side" aria-label="Acceso a OctoFilter">
        <div className="auth-topbar">
          <div className="auth-brand">
            <span className="auth-brand-mark">
              <span
                className="auth-brand-logo"
                style={{
                  WebkitMaskImage: `url(${logoUrl})`,
                  maskImage: `url(${logoUrl})`,
                }}
                aria-hidden="true"
              />
            </span>
            <span>
              <span className="auth-brand-name">OctoFilter</span>
              <span className="auth-brand-sub">Swarm Inteligence</span>
            </span>
          </div>

          <button
            type="button"
            className="theme-toggle"
            onClick={onThemeToggle}
            aria-label="Cambiar tema"
            title="Cambiar tema"
          >
            {theme === 'dark' ? <FiSun aria-hidden="true" /> : <FiMoon aria-hidden="true" />}
          </button>
        </div>

        <div className="auth-form-wrap">
          <div className="auth-kicker">Acceso</div>
          <h1 className="auth-title">Laboratorio de restauración</h1>
          <p className="auth-copy">
            Parametriza filtros, ejecuta metahuristica basada en inteligencia de colmena y revisa métricas desde una sesión aislada en esta máquina.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Correo</span>
              <span className="auth-input-wrap">
                <FiMail aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            <label className="auth-field">
              <span>Contraseña</span>
              <span className="auth-input-wrap">
                <FiLock aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-show-password"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                </button>
              </span>
            </label>

            <label className="auth-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={event => setRemember(event.target.checked)}
              />
              <span>Mantener sesión iniciada</span>
            </label>

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-submit" type="submit" disabled={loading}>
              <span>{loading ? 'Verificando' : 'Ingresar'}</span>
              <FiArrowRight aria-hidden="true" />
            </button>
          </form>
        </div>

        <div className="auth-foot">
          <span>v1.0.0 · OOA Image Optimization Tool</span>
          <span>Lucas Álvarez · Nicolás Corvalan</span>
        </div>
      </section>

      <section className="auth-visual" aria-hidden="true">
        <div className="auth-visual-grid" />
        <div className="auth-visual-content">
          <div>
            <span className="auth-visual-kicker">Octopus Optimization Algorithm</span>
            <p className="auth-visual-title">
              Ocho brazos exploran el espacio paramétrico.
              <span> Uno conserva la mejor configuración.</span>
            </p>
          </div>

          <OctopusViz />

          <div className="auth-visual-meta">
            <span>AD · BF · NLM</span>
            <span>MSE · SNR · PIQE</span>
            <span>OOA</span>
          </div>
        </div>
      </section>
    </main>
  );
}