"use client";
import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, RotateCcw, RotateCw } from "lucide-react";
export type DrawingStroke = { tool: "pen" | "eraser"; points: { x: number; y: number; p: number }[] };
export function DrawingAnswer({ strokes, onChange, disabled }: { strokes: DrawingStroke[]; onChange: (strokes: DrawingStroke[]) => void; disabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const current = useRef<DrawingStroke | null>(null);
  const [redo, setRedo] = useState<DrawingStroke[]>([]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [limit, setLimit] = useState(false);
  function paint(list: DrawingStroke[]) {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of list) {
      context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      context.strokeStyle = "#172554";
      context.lineCap = "round";
      context.lineJoin = "round";
      for (let i = 0; i < stroke.points.length; i++) {
        const point = stroke.points[i], previous = stroke.points[Math.max(0, i - 1)];
        context.lineWidth = stroke.tool === "eraser" ? 28 : 3 + point.p * 3;
        context.beginPath();
        context.moveTo(previous.x * canvas.width, previous.y * canvas.height);
        context.lineTo(point.x * canvas.width + .1, point.y * canvas.height + .1);
        context.stroke();
      }
    }
  }
  useEffect(() => { paint(strokes); }, [strokes]);
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)), p: event.pressure || .5 };
  }
  function finish() {
    if (current.current) { onChange([...strokes, current.current]); setRedo([]); current.current = null; }
  }
  return <div className="stack">
    <div className="row" aria-label="Drawing tools">
      <button className="secondary" aria-pressed={tool === "pen"} disabled={disabled} onClick={() => setTool("pen")}><PenLine size={18} /> Pen</button>
      <button className="secondary" aria-pressed={tool === "eraser"} disabled={disabled} onClick={() => setTool("eraser")}><Eraser size={18} /> Eraser</button>
      <button className="ghost" disabled={disabled || !strokes.length} onClick={() => { setRedo([strokes[strokes.length - 1], ...redo]); onChange(strokes.slice(0, -1)); setLimit(false); }}><RotateCcw size={18} /> Undo</button>
      <button className="ghost" disabled={disabled || !redo.length} onClick={() => { onChange([...strokes, redo[0]]); setRedo(redo.slice(1)); }}><RotateCw size={18} /> Redo</button>
    </div>
    <canvas ref={ref} width={1200} height={700} aria-label="Draw or write your answer with a finger or Pencil" className="answer-canvas"
      onPointerDown={event => { if (disabled) return; if(strokes.length >= 100 || strokes.reduce((n,s)=>n+s.points.length,0) >= 4000) { setLimit(true); return; } event.currentTarget.setPointerCapture(event.pointerId); current.current = { tool, points: [point(event)] }; paint([...strokes,current.current]); }}
      onPointerMove={event => { if (current.current && current.current.points.length < 1000 && strokes.reduce((n,s)=>n+s.points.length,0) + current.current.points.length < 4000) { current.current.points.push(point(event)); paint([...strokes, current.current]); } }}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} />
    <p className="muted">Use your finger or Apple Pencil. You can also type a description below. Your drawing is saved when you submit.</p>
    {limit && <p role="status" className="notice">The drawing is full. Undo a stroke or submit your work.</p>}
  </div>;
}
