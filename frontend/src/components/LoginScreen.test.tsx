import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoginScreen from './LoginScreen';

const defaultProps = {
  apiBase: 'http://localhost:8000',
  logoUrl: '/octopus.svg',
  theme: 'dark' as const,
  onThemeToggle: vi.fn(),
  onAuthenticated: vi.fn(),
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Pantalla de inicio de sesión', () => {
  it('envía las credenciales y entrega el usuario autenticado', async () => {
    const onAuthenticated = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: 1, email: 'test@mail.com' }, expires_at: '2030-01-01' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<LoginScreen {...defaultProps} onAuthenticated={onAuthenticated} />);

    await userEvent.type(screen.getByLabelText(/correo/i), ' test@mail.com ');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Test2026');
    await userEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith({ id: 1, email: 'test@mail.com' }));
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'test@mail.com', password: 'Test2026', remember: true }),
      }),
    );
  });

  it('muestra un error cuando la API responde 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    render(<LoginScreen {...defaultProps} />);

    await userEvent.type(screen.getByLabelText(/correo/i), 'test@mail.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText(/credenciales inválidas/i)).toBeInTheDocument();
  });

  it('alterna la visibilidad de la contraseña', async () => {
    render(<LoginScreen {...defaultProps} />);

    const password = screen.getByLabelText('Contraseña');
    expect(password).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: /mostrar contraseña/i }));
    expect(password).toHaveAttribute('type', 'text');
  });
});
