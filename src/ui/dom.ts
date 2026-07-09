export function requiredElement(documentRef: Document, id: string): HTMLElement {
  const element = documentRef.getElementById(id);
  if (element === null) {
    throw new Error(`Missing element #${id}`);
  }
  return element;
}

export function requiredInput(documentRef: Document, testId: string): HTMLInputElement {
  const element = documentRef.querySelector(`[data-testid="${testId}"]`);
  if (element instanceof HTMLInputElement) {
    return element;
  }
  throw new Error(`Missing input [data-testid="${testId}"]`);
}

export function requiredButton(documentRef: Document, testId: string): HTMLButtonElement {
  const element = documentRef.querySelector(`[data-testid="${testId}"]`);
  if (element instanceof HTMLButtonElement) {
    return element;
  }
  throw new Error(`Missing button [data-testid="${testId}"]`);
}

export function requiredCanvas(documentRef: Document, id: string): HTMLCanvasElement {
  const element = documentRef.getElementById(id);
  if (element instanceof HTMLCanvasElement) {
    return element;
  }
  throw new Error(`Missing canvas #${id}`);
}
