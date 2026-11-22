import { describe, expect, it } from "vitest";
import { createSseParser } from "./eventStream";

function parse(...chunks: string[]): string[] {
  const events: string[] = [];
  const parser = createSseParser((data) => events.push(data));
  for (const chunk of chunks) parser.push(chunk);
  return events;
}

describe("createSseParser", () => {
  it("reads the data of each event", () => {
    expect(parse('event: a\ndata: {"n":1}\n\nevent: b\ndata: {"n":2}\n\n')).toEqual(['{"n":1}', '{"n":2}']);
  });

  it("waits for the rest of an event split across chunks", () => {
    expect(parse('data: {"te', 'xt":"hi"}\n', "\n")).toEqual(['{"text":"hi"}']);
  });

  it("ignores heartbeat comments", () => {
    expect(parse(": ping\n\n", "data: 1\n\n")).toEqual(["1"]);
  });

  it("joins multi-line data and accepts CRLF", () => {
    expect(parse("data: one\r\ndata: two\r\n\r\n")).toEqual(["one\ntwo"]);
  });
});
