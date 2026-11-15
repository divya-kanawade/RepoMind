
"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

type MermaidDiagramProps = {
  chart: string;
  title: string;
  description?: string;
};

export default function MermaidDiagram({
  chart,
  title,
  description,
}: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      if (!containerRef.current) return;

      setError("");

      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: "basis",
          },
        });

        const id = `repomind-${crypto.randomUUID().replace(/-/g, "")}`;
        const { svg } = await mermaid.render(id, chart);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled) {
          setError("Unable to render this diagram. Please try again.");
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <section className="rounded-xl border border-[#d1d9e0] bg-white p-5">
      <div className="mb-4">
        <h3 className="font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-[#656d76]">{description}</p>
        )}
      </div>

      {error ? (
        <p className="rounded-lg bg-[#ffebe9] p-3 text-sm text-[#cf222e]">
          {error}
        </p>
      ) : (
        <div
          ref={containerRef}
          className="overflow-x-auto rounded-lg bg-[#f6f8fa] p-4"
        />
      )}
    </section>
  );
}
