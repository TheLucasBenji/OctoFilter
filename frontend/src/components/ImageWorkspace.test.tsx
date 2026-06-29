import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ImageWorkspace from './ImageWorkspace';

const imageBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

describe('Espacio de trabajo de imágenes', () => {
  it('carga una imagen cuando el espacio está vacío', async () => {
    const onFileUpload = vi.fn();
    const file = new File(['image'], 'fixture.png', { type: 'image/png' });

    render(
      <ImageWorkspace
        appState="idle"
        originalImage={null}
        noisyImage={null}
        resultImage={null}
        onFileUpload={onFileUpload}
      />,
    );

    await userEvent.upload(screen.getByTestId('workspace-file-input'), file);

    expect(onFileUpload).toHaveBeenCalledWith(file);
  });

  it('muestra el comparador y las acciones de descarga cuando hay resultado', () => {
    const onExportPdf = vi.fn();

    render(
      <ImageWorkspace
        appState="complete"
        originalImage={imageBase64}
        noisyImage={imageBase64}
        resultImage={imageBase64}
        onFileUpload={vi.fn()}
        onExportPdf={onExportPdf}
      />,
    );

    expect(screen.getByAltText('original')).toBeInTheDocument();
    expect(screen.getByAltText('noisy')).toBeInTheDocument();
    expect(screen.getByAltText('result')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /png/i })).toHaveAttribute('download', 'octopus_result.png');
    expect(screen.getByRole('button', { name: /pdf/i })).toBeEnabled();
  });
});
