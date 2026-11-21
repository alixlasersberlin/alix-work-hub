/** A blocked operation is application data, not a transport/runtime failure. */
export function blockedOperation(error: unknown) {
  return { ok: false, online: false, offline: false, error: error instanceof Error ? error.message : 'Webseitenvorgang fehlgeschlagen' };
}

export function operationStatus(status: number): number {
  return status === 409 ? 200 : status;
}