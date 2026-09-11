// Browser-compatible subset of Node's crypto module required by Midnight's
// encrypted private-state provider. The application never uses this module to
// derive or transmit ZK witnesses.
// @ts-expect-error crypto-browserify does not publish TypeScript declarations.
import cryptoBrowserify from "crypto-browserify";

export const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) throw new RangeError("Inputs must have equal length");
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a[i] ^ b[i];
  return result === 0;
};

export default { ...cryptoBrowserify, timingSafeEqual };
export * from "crypto-browserify";
