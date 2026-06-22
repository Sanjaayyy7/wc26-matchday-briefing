/**
 * Geographic → 3D sphere projection for the WC26 nations globe.
 *
 * Uses the standard three.js mapping: +Y is the north pole, and increasing
 * longitude sweeps the surface past the viewer as the globe rotates about Y.
 * Pure math — no three.js import — so it is unit-testable in plain Node.
 */

export type Vec3 = { x: number; y: number; z: number };

const DEG2RAD = Math.PI / 180;

/** Project (lat, lon) in degrees onto a sphere of `radius`, centred at origin. */
export function latLonToVec3(latDeg: number, lonDeg: number, radius: number): Vec3 {
  const phi = (90 - latDeg) * DEG2RAD; // polar angle measured from +Y
  const theta = (lonDeg + 180) * DEG2RAD; // azimuth around Y
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

/** Euclidean length of a vector — handy for asserting points lie on the sphere. */
export function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}
