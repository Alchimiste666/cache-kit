import {
  BatchReadThroughCacheWrapper,
  MemoryCacheStore,
  ReadThroughCacheWrapper,
} from "@alchemist-software/cache-kit-core";
import { SpanStatusCode } from "@opentelemetry/api";
import { TracingBatchReadThroughCache } from "./TracingBatchReadThroughCache";
import { TracingReadThroughCache } from "./TracingReadThroughCache";

// Mock span that captures setAttribute calls and status
function createMockSpan() {
  const attributes: Record<string, unknown> = {};
  const events: Array<{ name: string; attributes?: Record<string, unknown> }> = [];
  let status: { code: number; message?: string } | undefined;
  let ended = false;

  return {
    span: {
      setAttribute(key: string, value: unknown) {
        attributes[key] = value;
        return this;
      },
      setStatus(s: { code: number; message?: string }) {
        status = s;
      },
      recordException(error: Error) {
        events.push({ name: "exception", attributes: { message: error.message } });
      },
      end() {
        ended = true;
      },
    },
    getAttributes: () => attributes,
    getStatus: () => status,
    getEvents: () => events,
    isEnded: () => ended,
  };
}

// Mock tracer that captures span creation
function createMockTracer() {
  const spans: Array<ReturnType<typeof createMockSpan>> = [];

  const tracer = {
    startActiveSpan(_name: string, fn: (span: unknown) => unknown) {
      const mockSpan = createMockSpan();
      spans.push(mockSpan);
      return fn(mockSpan.span);
    },
  };

  return { tracer, spans };
}

// Mock the @opentelemetry/api module
jest.mock("@opentelemetry/api", () => {
  const actual = jest.requireActual("@opentelemetry/api");
  let currentTracer: unknown;

  return {
    ...actual,
    trace: {
      getTracer: () => currentTracer,
    },
    __setMockTracer: (tracer: unknown) => {
      currentTracer = tracer;
    },
  };
});

function setMockTracer(tracer: unknown) {
  const api = require("@opentelemetry/api");
  api.__setMockTracer(tracer);
}

describe("TracingReadThroughCache", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrRead span attributes", () => {
    it("should record cache.key and cache.hit=false on cache miss", async () => {
      const { tracer, spans } = createMockTracer();
      setMockTracer(tracer);

      const inner = new ReadThroughCacheWrapper<string, string>(new MemoryCacheStore());
      const cache = new TracingReadThroughCache(inner);

      const loader = jest.fn().mockResolvedValue("loaded-value");
      const result = await cache.getOrRead("my-key", loader);

      expect(result).toBe("loaded-value");
      expect(spans.length).toBeGreaterThanOrEqual(1);

      const lastSpan = spans[spans.length - 1];
      const attrs = lastSpan.getAttributes();
      expect(attrs["cache.key"]).toBe("my-key");
      expect(attrs["cache.hit"]).toBe(false);
    });

    it("should record cache.key and cache.hit=true on cache hit", async () => {
      const { tracer, spans } = createMockTracer();
      setMockTracer(tracer);

      const inner = new ReadThroughCacheWrapper<string, string>(new MemoryCacheStore());
      const cache = new TracingReadThroughCache(inner);

      await inner.set("my-key", "cached-value");

      const loader = jest.fn().mockResolvedValue("should-not-be-used");
      const result = await cache.getOrRead("my-key", loader);

      expect(result).toBe("cached-value");
      expect(loader).not.toHaveBeenCalled();

      const lastSpan = spans[spans.length - 1];
      const attrs = lastSpan.getAttributes();
      expect(attrs["cache.key"]).toBe("my-key");
      expect(attrs["cache.hit"]).toBe(true);
    });

    it("should record numeric keys as strings", async () => {
      const { tracer, spans } = createMockTracer();
      setMockTracer(tracer);

      const inner = new ReadThroughCacheWrapper<number, string>(new MemoryCacheStore());
      const cache = new TracingReadThroughCache(inner);

      const loader = jest.fn().mockResolvedValue("value");
      await cache.getOrRead(42, loader);

      const lastSpan = spans[spans.length - 1];
      expect(lastSpan.getAttributes()["cache.key"]).toBe("42");
    });
  });

  describe("error recording", () => {
    it("should set span status to ERROR and record exception when loader throws", async () => {
      const { tracer, spans } = createMockTracer();
      setMockTracer(tracer);

      const inner = new ReadThroughCacheWrapper<string, string>(new MemoryCacheStore());
      const cache = new TracingReadThroughCache(inner);

      const loader = jest.fn().mockRejectedValue(new Error("loader failed"));

      await expect(cache.getOrRead("key", loader)).rejects.toThrow("loader failed");

      const lastSpan = spans[spans.length - 1];
      const status = lastSpan.getStatus();
      expect(status?.code).toBe(SpanStatusCode.ERROR);

      const events = lastSpan.getEvents();
      expect(events.some((e) => e.name === "exception")).toBe(true);
    });

    it("should still end the span when an error occurs", async () => {
      const { tracer, spans } = createMockTracer();
      setMockTracer(tracer);

      const inner = new ReadThroughCacheWrapper<string, string>(new MemoryCacheStore());
      const cache = new TracingReadThroughCache(inner);

      const loader = jest.fn().mockRejectedValue(new Error("fail"));
      await expect(cache.getOrRead("key", loader)).rejects.toThrow();

      const lastSpan = spans[spans.length - 1];
      expect(lastSpan.isEnded()).toBe(true);
    });
  });
});

describe("TracingBatchReadThroughCache", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrReadMany span attributes", () => {
    it("should record cache.keys, cache.hits=0, cache.misses=N when all keys are misses", async () => {
      const { tracer, spans } = createMockTracer();
      setMockTracer(tracer);

      const store = new MemoryCacheStore<string, string>();
      const inner = new BatchReadThroughCacheWrapper<string, string>(store);
      const cache = new TracingBatchReadThroughCache(inner);

      const loader = jest.fn().mockResolvedValue(
        new Map([
          ["a", "val-a"],
          ["b", "val-b"],
          ["c", "val-c"],
        ]),
      );

      const result = await cache.getOrReadMany(["a", "b", "c"], loader);

      expect(result.size).toBe(3);

      const lastSpan = spans[spans.length - 1];
      const attrs = lastSpan.getAttributes();
      expect(attrs["cache.keys"]).toBe("a,b,c");
      expect(attrs["cache.hits"]).toBe(0);
      expect(attrs["cache.misses"]).toBe(3);
    });

    it("should record cache.hits=N, cache.misses=0 when all keys are cached", async () => {
      const { tracer, spans } = createMockTracer();
      setMockTracer(tracer);

      const store = new MemoryCacheStore<string, string>();
      const inner = new BatchReadThroughCacheWrapper<string, string>(store);
      const cache = new TracingBatchReadThroughCache(inner);

      await inner.set("a", "cached-a");
      await inner.set("b", "cached-b");

      const loader = jest.fn().mockResolvedValue(new Map());
      await cache.getOrReadMany(["a", "b"], loader);

      const lastSpan = spans[spans.length - 1];
      const attrs = lastSpan.getAttributes();
      expect(attrs["cache.hits"]).toBe(2);
      expect(attrs["cache.misses"]).toBe(0);
    });

    it("should record correct hits and misses for partial cache", async () => {
      const { tracer, spans } = createMockTracer();
      setMockTracer(tracer);

      const store = new MemoryCacheStore<string, string>();
      const inner = new BatchReadThroughCacheWrapper<string, string>(store);
      const cache = new TracingBatchReadThroughCache(inner);

      // Pre-cache "a" only
      await inner.set("a", "cached-a");

      const loader = jest.fn().mockResolvedValue(
        new Map([
          ["b", "loaded-b"],
          ["c", "loaded-c"],
        ]),
      );

      const result = await cache.getOrReadMany(["a", "b", "c"], loader);

      expect(result.size).toBe(3);

      const lastSpan = spans[spans.length - 1];
      const attrs = lastSpan.getAttributes();
      expect(attrs["cache.keys"]).toBe("a,b,c");
      expect(attrs["cache.hits"]).toBe(1);
      expect(attrs["cache.misses"]).toBe(2);
      // hits + misses = total keys
      expect((attrs["cache.hits"] as number) + (attrs["cache.misses"] as number)).toBe(3);
    });
  });

  describe("error recording (batch)", () => {
    it("should set span status to ERROR and record exception when loader throws", async () => {
      const { tracer, spans } = createMockTracer();
      setMockTracer(tracer);

      const store = new MemoryCacheStore<string, string>();
      const inner = new BatchReadThroughCacheWrapper<string, string>(store);
      const cache = new TracingBatchReadThroughCache(inner);

      const loader = jest.fn().mockRejectedValue(new Error("batch failed"));

      await expect(cache.getOrReadMany(["a", "b"], loader)).rejects.toThrow("batch failed");

      const lastSpan = spans[spans.length - 1];
      const status = lastSpan.getStatus();
      expect(status?.code).toBe(SpanStatusCode.ERROR);

      const events = lastSpan.getEvents();
      expect(events.some((e) => e.name === "exception")).toBe(true);
    });
  });
});
