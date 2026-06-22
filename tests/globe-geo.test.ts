import { describe, it, expect } from "vitest";
import { latLonToVec3, length } from "@/lib/globe-geo";

describe("latLonToVec3", () => {
  it("maps the north pole to +Y", () => {
    const v = latLonToVec3(90, 0, 2);
    expect(v.y).toBeCloseTo(2, 5);
    expect(v.x).toBeCloseTo(0, 5);
    expect(v.z).toBeCloseTo(0, 5);
  });

  it("maps the south pole to -Y", () => {
    const v = latLonToVec3(-90, 123, 2);
    expect(v.y).toBeCloseTo(-2, 5);
    expect(v.x).toBeCloseTo(0, 5);
    expect(v.z).toBeCloseTo(0, 5);
  });

  it("keeps every point on the sphere of the given radius", () => {
    for (const [lat, lon] of [
      [0, 0],
      [40, -3.7], // Spain
      [-33, -56], // Uruguay
      [36, 138], // Japan
      [39.8, -98.6], // USA
    ] as const) {
      expect(length(latLonToVec3(lat, lon, 1.6))).toBeCloseTo(1.6, 5);
    }
  });

  it("scales linearly with radius", () => {
    const a = latLonToVec3(20, 50, 1);
    const b = latLonToVec3(20, 50, 3);
    expect(b.x).toBeCloseTo(a.x * 3, 5);
    expect(b.y).toBeCloseTo(a.y * 3, 5);
    expect(b.z).toBeCloseTo(a.z * 3, 5);
  });

  it("places the equator in the XZ plane (y = 0)", () => {
    expect(latLonToVec3(0, 0, 5).y).toBeCloseTo(0, 5);
    expect(latLonToVec3(0, 90, 5).y).toBeCloseTo(0, 5);
  });
});
