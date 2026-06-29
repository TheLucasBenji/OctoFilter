import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';
import type { AppParams } from '../types';

const params: AppParams = {
  filterType: 'bilateral',
  metricType: 'mse',
  noiseType: 'gaussian',
  noiseSigma: 25,
  noiseAmount: 0.05,
  population: 30,
  iterations: 50,
  seed: '',
  algorithm: 'ooa',
};

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  if (!vi.isMockFunction(globalThis.fetch)) {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  }

  const props = {
    params,
    onChange: vi.fn(),
    onRun: vi.fn(),
    onCancel: vi.fn(),
    canRun: true,
    appState: 'previewing' as const,
    currentIteration: 0,
    elapsedMs: 0,
    mode: 'advanced' as const,
    estimate: null,
    estimating: false,
    ...overrides,
  };
  render(<Sidebar {...props} />);
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Barra lateral', () => {
  it('mantiene deshabilitado Ejecutar cuando no hay imagen', () => {
    renderSidebar({ canRun: false });

    expect(screen.getByRole('button', { name: /ejecutar/i })).toBeDisabled();
  });

  it('llama a la acción de optimizar cuando Ejecutar está habilitado', async () => {
    const onRun = vi.fn();
    renderSidebar({ onRun });

    await userEvent.click(screen.getByRole('button', { name: /ejecutar/i }));

    expect(onRun).toHaveBeenCalledOnce();
  });

  it('informa cambios de algoritmo, métrica, población e iteraciones', async () => {
    const onChange = vi.fn();
    renderSidebar({ onChange });

    await userEvent.click(screen.getByRole('button', { name: /starfish/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ algorithm: 'sfoa' }));

    await userEvent.click(screen.getByRole('button', { name: /snr/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ metricType: 'snr' }));

    fireEvent.change(screen.getByLabelText('Población', { selector: 'input' }), { target: { value: '9' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ population: 9 }));

    fireEvent.change(screen.getByLabelText('Iteraciones', { selector: 'input' }), { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ iterations: 5 }));
  });

  it('muestra los metadatos de filtros cuando la API responde', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bilateral: {
            label: 'Bilateral',
            dim: 3,
            params: [{ name: 'd', lb: 1, ub: 9 }],
          },
        }),
      }),
    );

    renderSidebar();

    await waitFor(() => expect(screen.getByText('d')).toBeInTheDocument());
  });
});
