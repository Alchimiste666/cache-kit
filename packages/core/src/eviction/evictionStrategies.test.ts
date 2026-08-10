import type { CacheEntry } from "../types/CacheEntry";
import { CompositeCacheEviction } from "./CompositeCacheEviction";
import { FIFOCacheEviction } from "./FIFOCacheEviction";
import { LRUCacheEviction } from "./LRUCacheEviction";
import { RandomCacheEviction } from "./RandomCacheEviction";
import { S3FIFOCacheEviction } from "./S3FIFOCacheEviction";
import { TinyLFUCacheEviction } from "./TinyLFUCacheEviction";
import { TTLCacheEviction } from "./TTLCacheEviction";

type TestKey = string;
type TestValue = number;

function createEntry(
  key: TestKey,
  value: TestValue,
  createdAt = 0,
): CacheEntry<TestKey, TestValue> {
  return {
    key,
    value,
    createdAt,
    lastAccessedAt: createdAt,
  };
}

describe("TinyLFUCacheEviction", () => {
  it("should order candidates by frequency and then creation time", () => {
    const eviction = new TinyLFUCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1, 1);
    const entryB = createEntry("b", 2, 2);
    const entryC = createEntry("c", 3, 3);

    eviction.onSet(entryA);
    eviction.onSet(entryB);
    eviction.onSet(entryC);

    eviction.onGet(entryB);
    eviction.onGet(entryB);
    eviction.onGet(entryC);

    const keys = eviction.candidates().map((entry) => entry.key);

    expect(keys).toEqual(["a", "c", "b"]);
  });

  it("should clear frequency on delete", () => {
    const eviction = new TinyLFUCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1, 1);
    eviction.onSet(entryA);
    eviction.onGet(entryA);
    eviction.onGet(entryA);
    eviction.onDelete(entryA);

    expect(eviction.candidates()).toEqual([]);
  });

  it("should break ties by creation time (older evicted first)", () => {
    const eviction = new TinyLFUCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1, 100);
    const entryB = createEntry("b", 2, 50); // older

    eviction.onSet(entryA);
    eviction.onSet(entryB);
    // Both have frequency=1 (from onSet), so tie-break by createdAt

    const keys = eviction.candidates().map((e) => e.key);
    expect(keys).toEqual(["b", "a"]);
  });

  it("should return empty array when no entries exist", () => {
    const eviction = new TinyLFUCacheEviction<TestKey, TestValue>();
    expect(eviction.candidates()).toEqual([]);
  });
});

describe("S3FIFOCacheEviction", () => {
  it("should promote accessed entries to warm queue and prefer cold entries for eviction", () => {
    const eviction = new S3FIFOCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1, 1);
    const entryB = createEntry("b", 2, 2);
    const entryC = createEntry("c", 3, 3);

    eviction.onSet(entryA);
    eviction.onSet(entryB);
    eviction.onSet(entryC);

    eviction.onGet(entryB);

    const keys = eviction.candidates().map((entry) => entry.key);

    expect(keys).toEqual(["a", "c", "b"]);
  });

  it("should keep warm entries at the end of candidates", () => {
    const eviction = new S3FIFOCacheEviction<TestKey, TestValue>();

    eviction.onSet(createEntry("a", 1));
    eviction.onSet(createEntry("b", 2));
    eviction.onSet(createEntry("c", 3));

    eviction.onGet(createEntry("a", 1)); // promote a to warm
    eviction.onGet(createEntry("c", 3)); // promote c to warm

    const keys = eviction.candidates().map((e) => e.key);
    // cold: [b], warm: [a, c]
    expect(keys).toEqual(["b", "a", "c"]);
  });

  it("should remove entry from both queues on delete", () => {
    const eviction = new S3FIFOCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1);
    eviction.onSet(entryA);
    eviction.onGet(entryA); // promote to warm
    eviction.onDelete(entryA);

    expect(eviction.candidates()).toEqual([]);
  });

  it("should update position in warm queue on re-set of warm entry", () => {
    const eviction = new S3FIFOCacheEviction<TestKey, TestValue>();

    eviction.onSet(createEntry("a", 1));
    eviction.onSet(createEntry("b", 2));

    eviction.onGet(createEntry("a", 1)); // a -> warm
    eviction.onGet(createEntry("b", 2)); // b -> warm

    eviction.onSet(createEntry("a", 10)); // re-set a in warm (moves to end)

    const keys = eviction.candidates().map((e) => e.key);
    // cold: [], warm: [b, a]
    expect(keys).toEqual(["b", "a"]);
  });

  it("should return empty array when no entries exist", () => {
    const eviction = new S3FIFOCacheEviction<TestKey, TestValue>();
    expect(eviction.candidates()).toEqual([]);
  });
});

describe("FIFOCacheEviction", () => {
  it("should evict entries in insertion order", () => {
    const eviction = new FIFOCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1, 1);
    const entryB = createEntry("b", 2, 2);
    const entryC = createEntry("c", 3, 3);

    eviction.onSet(entryA);
    eviction.onSet(entryB);
    eviction.onSet(entryC);

    const keys = eviction.candidates().map((entry) => entry.key);

    expect(keys).toEqual(["a", "b", "c"]);
  });

  it("should remove deleted entries from candidates", () => {
    const eviction = new FIFOCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1);
    const entryB = createEntry("b", 2);

    eviction.onSet(entryA);
    eviction.onSet(entryB);
    eviction.onDelete(entryA);

    const keys = eviction.candidates().map((e) => e.key);
    expect(keys).toEqual(["b"]);
  });

  it("should move re-set entry to the end (newest position)", () => {
    const eviction = new FIFOCacheEviction<TestKey, TestValue>();

    eviction.onSet(createEntry("a", 1));
    eviction.onSet(createEntry("b", 2));
    eviction.onSet(createEntry("a", 10)); // re-insert "a"

    const keys = eviction.candidates().map((e) => e.key);
    expect(keys).toEqual(["b", "a"]);
  });

  it("should return empty array when no entries exist", () => {
    const eviction = new FIFOCacheEviction<TestKey, TestValue>();
    expect(eviction.candidates()).toEqual([]);
  });

  it("should not change order on get (FIFO ignores reads)", () => {
    const eviction = new FIFOCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1);
    const entryB = createEntry("b", 2);

    eviction.onSet(entryA);
    eviction.onSet(entryB);
    eviction.onGet(entryA);

    const keys = eviction.candidates().map((e) => e.key);
    expect(keys).toEqual(["a", "b"]);
  });
});

describe("LRUCacheEviction", () => {
  it("should evict least recently used entries first", () => {
    const eviction = new LRUCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1, 1);
    const entryB = createEntry("b", 2, 2);
    const entryC = createEntry("c", 3, 3);

    eviction.onSet(entryA);
    eviction.onSet(entryB);
    eviction.onSet(entryC);

    eviction.onGet(entryB);

    const keys = eviction.candidates().map((entry) => entry.key);

    expect(keys).toEqual(["a", "c", "b"]);
  });

  it("should move entry to most-recent on multiple accesses", () => {
    const eviction = new LRUCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1);
    const entryB = createEntry("b", 2);
    const entryC = createEntry("c", 3);

    eviction.onSet(entryA);
    eviction.onSet(entryB);
    eviction.onSet(entryC);

    eviction.onGet(entryA); // a is now most recent
    eviction.onGet(entryC); // c is now most recent

    const keys = eviction.candidates().map((e) => e.key);
    expect(keys).toEqual(["b", "a", "c"]);
  });

  it("should remove deleted entries from candidates", () => {
    const eviction = new LRUCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1);
    const entryB = createEntry("b", 2);

    eviction.onSet(entryA);
    eviction.onSet(entryB);
    eviction.onDelete(entryA);

    expect(eviction.candidates().map((e) => e.key)).toEqual(["b"]);
  });

  it("should return empty array when no entries exist", () => {
    const eviction = new LRUCacheEviction<TestKey, TestValue>();
    expect(eviction.candidates()).toEqual([]);
  });
});

describe("RandomCacheEviction", () => {
  it("should return a random candidate from the available entries", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.5);

    const eviction = new RandomCacheEviction<TestKey, TestValue>();

    const entryA = createEntry("a", 1, 1);
    const entryB = createEntry("b", 2, 2);
    const entryC = createEntry("c", 3, 3);

    eviction.onSet(entryA);
    eviction.onSet(entryB);
    eviction.onSet(entryC);

    const candidates = eviction.candidates();

    expect(candidates).toHaveLength(1);
    expect(["a", "b", "c"]).toContain(candidates[0].key);

    jest.spyOn(Math, "random").mockRestore();
  });

  it("should return empty array when no entries exist", () => {
    const eviction = new RandomCacheEviction<TestKey, TestValue>();
    expect(eviction.candidates()).toEqual([]);
  });

  it("should not include deleted entries", () => {
    const eviction = new RandomCacheEviction<TestKey, TestValue>();

    const entry = createEntry("a", 1);
    eviction.onSet(entry);
    eviction.onDelete(entry);

    expect(eviction.candidates()).toEqual([]);
  });

  it("should return the only entry when there is one", () => {
    jest.spyOn(Math, "random").mockReturnValue(0);

    const eviction = new RandomCacheEviction<TestKey, TestValue>();
    eviction.onSet(createEntry("solo", 1));

    const candidates = eviction.candidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].key).toBe("solo");

    jest.spyOn(Math, "random").mockRestore();
  });
});

describe("TTLCacheEviction", () => {
  it("should order entries by expiration timestamp and ignore entries without expiresAt", () => {
    const eviction = new TTLCacheEviction<TestKey, TestValue>();

    const entryA = {
      ...createEntry("a", 1, 1),
      expiresAt: 5,
    };
    const entryB = {
      ...createEntry("b", 2, 2),
      expiresAt: 2,
    };
    const entryC = {
      ...createEntry("c", 3, 3),
      expiresAt: 10,
    };

    eviction.onSet(entryA);
    eviction.onSet(entryB);
    eviction.onSet(entryC);

    const keys = eviction.candidates().map((entry) => entry.key);

    expect(keys).toEqual(["b", "a", "c"]);
  });

  it("should exclude entries without expiresAt from candidates", () => {
    const eviction = new TTLCacheEviction<TestKey, TestValue>();

    eviction.onSet(createEntry("no-ttl", 1));
    eviction.onSet({ ...createEntry("has-ttl", 2), expiresAt: 100 });

    const keys = eviction.candidates().map((e) => e.key);
    expect(keys).toEqual(["has-ttl"]);
  });

  it("should return empty array when all entries lack expiresAt", () => {
    const eviction = new TTLCacheEviction<TestKey, TestValue>();

    eviction.onSet(createEntry("a", 1));
    eviction.onSet(createEntry("b", 2));

    expect(eviction.candidates()).toEqual([]);
  });

  it("should remove deleted entries", () => {
    const eviction = new TTLCacheEviction<TestKey, TestValue>();

    const entry = { ...createEntry("a", 1), expiresAt: 10 };
    eviction.onSet(entry);
    eviction.onDelete(entry);

    expect(eviction.candidates()).toEqual([]);
  });
});

describe("CompositeCacheEviction", () => {
  it("should merge candidates from multiple policies without duplicates", () => {
    const policyA = {
      onGet: jest.fn(),
      onSet: jest.fn(),
      onDelete: jest.fn(),
      candidates: () => [createEntry("a", 1), createEntry("b", 2)],
    };

    const policyB = {
      onGet: jest.fn(),
      onSet: jest.fn(),
      onDelete: jest.fn(),
      candidates: () => [createEntry("b", 2), createEntry("c", 3)],
    };

    const eviction = new CompositeCacheEviction<TestKey, TestValue>([policyA, policyB]);

    const keys = eviction.candidates().map((entry) => entry.key);

    expect(keys).toEqual(["a", "b", "c"]);
  });

  it("should delegate onGet to all policies", () => {
    const policyA = {
      onGet: jest.fn(),
      onSet: jest.fn(),
      onDelete: jest.fn(),
      candidates: () => [],
    };
    const policyB = {
      onGet: jest.fn(),
      onSet: jest.fn(),
      onDelete: jest.fn(),
      candidates: () => [],
    };

    const eviction = new CompositeCacheEviction<TestKey, TestValue>([policyA, policyB]);
    const entry = createEntry("x", 1);

    eviction.onGet(entry);

    expect(policyA.onGet).toHaveBeenCalledWith(entry);
    expect(policyB.onGet).toHaveBeenCalledWith(entry);
  });

  it("should delegate onSet to all policies", () => {
    const policyA = {
      onGet: jest.fn(),
      onSet: jest.fn(),
      onDelete: jest.fn(),
      candidates: () => [],
    };
    const policyB = {
      onGet: jest.fn(),
      onSet: jest.fn(),
      onDelete: jest.fn(),
      candidates: () => [],
    };

    const eviction = new CompositeCacheEviction<TestKey, TestValue>([policyA, policyB]);
    const entry = createEntry("x", 1);

    eviction.onSet(entry);

    expect(policyA.onSet).toHaveBeenCalledWith(entry);
    expect(policyB.onSet).toHaveBeenCalledWith(entry);
  });

  it("should delegate onDelete to all policies", () => {
    const policyA = {
      onGet: jest.fn(),
      onSet: jest.fn(),
      onDelete: jest.fn(),
      candidates: () => [],
    };
    const policyB = {
      onGet: jest.fn(),
      onSet: jest.fn(),
      onDelete: jest.fn(),
      candidates: () => [],
    };

    const eviction = new CompositeCacheEviction<TestKey, TestValue>([policyA, policyB]);
    const entry = createEntry("x", 1);

    eviction.onDelete(entry);

    expect(policyA.onDelete).toHaveBeenCalledWith(entry);
    expect(policyB.onDelete).toHaveBeenCalledWith(entry);
  });

  it("should return empty array when all policies return empty", () => {
    const policyA = {
      onGet: jest.fn(),
      onSet: jest.fn(),
      onDelete: jest.fn(),
      candidates: () => [],
    };
    const eviction = new CompositeCacheEviction<TestKey, TestValue>([policyA]);

    expect(eviction.candidates()).toEqual([]);
  });
});
