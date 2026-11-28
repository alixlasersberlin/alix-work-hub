/** Uniform six-digit authentication code from the runtime's cryptographic generator. */
export function sixDigitCode(random: (bytes: Uint32Array) => Uint32Array = bytes => crypto.getRandomValues(bytes)): string {
  const limit = Math.floor(0x100000000 / 900000) * 900000;
  const bytes = new Uint32Array(1);
  do { random(bytes); } while (bytes[0] >= limit);
  return String(100000 + bytes[0] % 900000);
}