import { describe, expect, it } from "vitest";
import { sealArtifact } from "./sealArtifact";

describe("sealArtifact", () => {
  it("puts the policy straight after the doctype, ahead of everything the page brought", () => {
    const sealed = sealArtifact("<!DOCTYPE html><html><head><title>Plan</title></head><body>Hi</body></html>");

    expect(sealed).toMatch(/^<!DOCTYPE html><meta http-equiv="Content-Security-Policy"/);
    expect(sealed.indexOf("Content-Security-Policy")).toBeLessThan(sealed.indexOf("<title>"));
    expect(sealed).toContain("<body>Hi</body>");
  });

  it("gives a page that has no doctype one, so it is not drawn in quirks mode", () => {
    expect(sealArtifact("<h1>Hi</h1>")).toMatch(/^<!doctype html><meta http-equiv="Content-Security-Policy"[^>]*><h1>Hi<\/h1>$/);
  });

  it("allows no network request and no form to be sent", () => {
    const sealed = sealArtifact("<p>x</p>");

    expect(sealed).toContain("default-src 'none'");
    expect(sealed).toContain("connect-src 'none'");
    expect(sealed).toContain("form-action 'none'");
    expect(sealed).not.toContain("img-src data: blob: https");
  });
});
