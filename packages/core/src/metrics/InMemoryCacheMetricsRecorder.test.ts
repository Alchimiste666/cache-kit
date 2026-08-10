import { InMemoryCacheMetricsRecorder } from "./InMemoryCacheMetricsRecorder";

describe("InMemoryCacheMetricsRecorder", () => {
  let recorder: InMemoryCacheMetricsRecorder;

  beforeEach(() => {
    recorder = new InMemoryCacheMetricsRecorder();
  });

  it("should start with all zeros", () => {
    expect(recorder.stats()).toEqual({
      hits: 0,
      misses: 0,
      loads: 0,
      evictions: 0,
      writes: 0,
      deletes: 0,
    });
  });

  it("should increment hits", () => {
    recorder.hits();
    recorder.hits();
    expect(recorder.stats().hits).toBe(2);
  });

  it("should increment misses", () => {
    recorder.misses();
    expect(recorder.stats().misses).toBe(1);
  });

  it("should increment loads", () => {
    recorder.loads(3);
    expect(recorder.stats().loads).toBe(3);
  });

  it("should increment evictions", () => {
    recorder.evictions(5);
    expect(recorder.stats().evictions).toBe(5);
  });

  it("should increment writes", () => {
    recorder.writes();
    recorder.writes(2);
    expect(recorder.stats().writes).toBe(3);
  });

  it("should increment deletes", () => {
    recorder.deletes(4);
    expect(recorder.stats().deletes).toBe(4);
  });

  it("should accept custom count parameter", () => {
    recorder.hits(10);
    recorder.misses(5);
    expect(recorder.stats().hits).toBe(10);
    expect(recorder.stats().misses).toBe(5);
  });

  it("should reset all counters to zero", () => {
    recorder.hits(5);
    recorder.misses(3);
    recorder.loads(2);
    recorder.evictions(1);
    recorder.writes(4);
    recorder.deletes(6);

    recorder.reset();

    expect(recorder.stats()).toEqual({
      hits: 0,
      misses: 0,
      loads: 0,
      evictions: 0,
      writes: 0,
      deletes: 0,
    });
  });

  it("should return a copy from stats() (not a reference)", () => {
    recorder.hits(1);
    const s1 = recorder.stats();
    recorder.hits(1);
    const s2 = recorder.stats();

    expect(s1.hits).toBe(1);
    expect(s2.hits).toBe(2);
  });
});
