// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionPlayer } from "@/components/question-player";
vi.mock("next/navigation", () => ({usePathname: () => "/s/learner/assignment/demo"}));
vi.mock("next/link", () => ({default: "a"}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const make = (type: string, options: {id:string;text:string}[] = []) => ({ id: type, type, options, prompt: { text: `Prompt ${type}`, translationPolicy: "disabled" } });
function mount(questions: ReturnType<typeof make>[]) { render(createElement(QuestionPlayer, {assignmentId: "demo", questions})); }
describe("question interactions", () => {
  it("submits ordering as an array and lets reviewed responses advance", async () => {
    const fetcher = vi.fn().mockResolvedValue({ok: true, json: async () => ({data: {status: "needs_review", canRetry: false}})});
    vi.stubGlobal("fetch", fetcher);
    mount([make("ordering", [{id:"b",text:"Second"},{id:"a",text:"First"}]), make("long_text")]);
    fireEvent.click(screen.getByLabelText("Move First up"));
    fireEvent.click(screen.getByText("Check answer"));
    await screen.findByText("Next question");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).response.value).toEqual(["a","b"]);
    fireEvent.click(screen.getByText("Next question"));
    expect(screen.getByRole("textbox").tagName).toBe("TEXTAREA");
    fireEvent.change(screen.getByRole("textbox"), {target: {value: "My explanation"}});
    fireEvent.click(screen.getByText("Submit for review"));
    await screen.findByText("Finish practice");
    fireEvent.click(screen.getByText("Finish practice"));
    expect(screen.getByText("Practice complete!")).toBeTruthy();
  });
  it("keeps a network error distinct from a saved review response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    mount([make("short_text")]);
    fireEvent.change(screen.getByRole("textbox"), {target:{value:"hello"}});
    fireEvent.click(screen.getByText("Check answer"));
    await screen.findByRole("alert");
    expect(screen.queryByText("Finish practice")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("hello");
  });
  it("submits multiple selections and false without treating them as empty", async () => {
    const fetcher = vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{status:"correct",canRetry:false}})});
    vi.stubGlobal("fetch",fetcher);
    mount([make("multiple_choice",[{id:"a",text:"Apple"},{id:"b",text:"Pear"}]),make("true_false")]);
    fireEvent.click(screen.getByText("Apple")); fireEvent.click(screen.getByText("Pear"));
    fireEvent.click(screen.getByText("Check answer")); await screen.findByText("Next question");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).response.value).toEqual(["a","b"]);
    fireEvent.click(screen.getByText("Next question")); fireEvent.click(screen.getByText("False"));
    fireEvent.click(screen.getByText("Check answer"));
    await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetcher.mock.calls[1][1].body).response.value).toBe(false);
  });
});
