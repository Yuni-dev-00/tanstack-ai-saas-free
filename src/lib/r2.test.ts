import { describe, it, expect } from "vitest";
import {
  jobOutputKey,
  uploadKey,
  publicUrlFor,
  extForMime,
} from "./r2";

describe("jobOutputKey", () => {
  it("composes jobs/<id>/<i>.<ext>", () => {
    expect(jobOutputKey("j-1", 0, "png")).toBe("jobs/j-1/0.png");
    expect(jobOutputKey("abc", 3, "mp4")).toBe("jobs/abc/3.mp4");
  });
});

describe("uploadKey", () => {
  it("composes u/<prefix>/uploads/<ulid>.<ext>", () => {
    expect(uploadKey("user_42", "01HABC", "jpg")).toBe(
      "u/user_42/uploads/01HABC.jpg",
    );
    expect(uploadKey("anon-abc123", "01HXYZ", "png")).toBe(
      "u/anon-abc123/uploads/01HXYZ.png",
    );
  });
});

describe("publicUrlFor", () => {
  it("trims trailing slash from R2_PUBLIC_BASE", () => {
    expect(
      publicUrlFor({ R2_PUBLIC_BASE: "https://cdn.example.com/" }, "a/b.png"),
    ).toBe("https://cdn.example.com/a/b.png");
    expect(
      publicUrlFor({ R2_PUBLIC_BASE: "https://cdn.example.com" }, "a/b.png"),
    ).toBe("https://cdn.example.com/a/b.png");
  });
});

describe("extForMime", () => {
  it("maps common image/video MIME types to extensions", () => {
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/webp")).toBe("webp");
    expect(extForMime("image/gif")).toBe("gif");
    expect(extForMime("video/mp4")).toBe("mp4");
  });

  it("falls back to 'bin' for unknown MIMEs", () => {
    expect(extForMime("application/octet-stream")).toBe("bin");
    expect(extForMime("")).toBe("bin");
  });
});
