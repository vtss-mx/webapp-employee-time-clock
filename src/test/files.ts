import { fireEvent } from '@testing-library/react';

/** Elige archivos en un `<input type="file">` (vacío = canceló el diálogo), con una `FileList` como la del navegador. */
export function chooseFiles(input: HTMLElement, ...files: File[]): void {
  const list = Object.assign(Object.fromEntries(files.map((file, index) => [index, file])), {
    length: files.length,
    item: (index: number) => files[index] ?? null,
  });
  fireEvent.change(input, { target: { files: list } });
}
