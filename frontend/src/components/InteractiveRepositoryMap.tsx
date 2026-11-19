"use client";

import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type MapData = {
  label: string;
  description: string;
  category: string;
  details?: string[];
};

type Props = {
  repositoryName: string;
  technologies?: string[];
  languages?: Record<string, number>;
  directories?: string[];
  files?: string[];
};

function RepositoryNode({ data }: NodeProps<Node<MapData>>) {
  const colors: Record<string, string> = {
    repository: "border-violet-400 bg-violet-50",
    section: "border-blue-400 bg-blue-50",
    technology: "border-cyan-400 bg-cyan-50",
    folder: "border-amber-400 bg-amber-50",
    file: "border-slate-300 bg-white",
    ai: "border-emerald-400 bg-emerald-50",
  };

  return (
    <div className={`min-w-[180px] max-w-[230px] rounded-xl border-2 p-3 shadow-sm ${colors[data.category] || "border-slate-300 bg-white"}`}>
      <Handle type="target" position={Position.Top} />
      <div className="text-xs font-semibold uppercase text-slate-500">
        {data.category}
      </div>
      <div className="mt-1 break-words text-sm font-bold text-slate-900">
        {data.label}
      </div>
      <div className="mt-1 text-xs text-slate-600">{data.description}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { repositoryNode: RepositoryNode };

function MapContent({
  repositoryName,
  technologies = [],
  languages = {},
  directories = [],
  files = [],
}: Props) {
  const [selected, setSelected] = useState<MapData | null>(null);

  const nodes = useMemo<Node<MapData>[]>(() => {
    const result: Node<MapData>[] = [];

    const add = (
      id: string,
      label: string,
      description: string,
      category: string,
      x: number,
      y: number,
      details: string[] = []
    ) => {
      result.push({
        id,
        type: "repositoryNode",
        position: { x, y },
        data: { label, description, category, details },
      });
    };

    add(
      "repository",
      repositoryName || "Repository",
      "Analyzed GitHub repository",
      "repository",
      500,
      20
    );

    const sections: [string, string, string, string, number][] = [
      ["structure", "Project Structure", "Folders and files", "section", 50],
      ["technology", "Technology Stack", "Frameworks and tools", "section", 350],
      ["languages", "Programming Languages", "Detected languages", "section", 650],
      ["ai", "RepoMind AI", "Repository intelligence", "ai", 950],
    ];

    sections.forEach(([id, label, description, category, x]) => {
      add(id, label, description, category, Number(x), 180);
    });

    directories.slice(0, 12).forEach((directory, i) => {
      add(
        `directory-${i}`,
        directory,
        "Repository directory",
        "folder",
        20 + (i % 3) * 210,
        350 + Math.floor(i / 3) * 140,
        [directory]
      );
    });

    technologies.slice(0, 12).forEach((technology, i) => {
      add(
        `technology-${i}`,
        technology,
        "Detected technology",
        "technology",
        340 + (i % 2) * 220,
        350 + Math.floor(i / 2) * 140,
        [technology]
      );
    });

    Object.entries(languages).slice(0, 10).forEach(([language, value], i) => {
      add(
        `language-${i}`,
        language,
        "Programming language",
        "technology",
        650 + (i % 2) * 220,
        350 + Math.floor(i / 2) * 140,
        [language, `Reported value: ${value}`]
      );
    });

    [
      ["summary", "Project Summary", "Repository overview"],
      ["rag", "Ask Questions", "RAG-powered repository chatbot"],
      ["explorer", "Full Folder Structure", "Browse repository hierarchy"],
    ].forEach(([id, label, description], i) => {
      add(id, label, description, "ai", 950, 350 + i * 150);
    });

    files.slice(0, 8).forEach((file, i) => {
      add(
        `file-${i}`,
        file.split("/").pop() || file,
        "Repository file",
        "file",
        20 + (i % 3) * 210,
        850 + Math.floor(i / 3) * 130,
        [file]
      );
    });

    return result;
  }, [repositoryName, technologies, languages, directories, files]);

  const edges = useMemo<Edge[]>(() => {
    const result: Edge[] = [];
    const connect = (source: string, target: string) => {
      result.push({
        id: `${source}-${target}`,
        source,
        target,
        animated: true,
      });
    };

    ["structure", "technology", "languages", "ai"].forEach((id) =>
      connect("repository", id)
    );

    directories.slice(0, 12).forEach((_, i) =>
      connect("structure", `directory-${i}`)
    );

    technologies.slice(0, 12).forEach((_, i) =>
      connect("technology", `technology-${i}`)
    );

    Object.keys(languages).slice(0, 10).forEach((_, i) =>
      connect("languages", `language-${i}`)
    );

    ["summary", "rag", "explorer"].forEach((id) => connect("ai", id));

    files.slice(0, 8).forEach((_, i) =>
      connect("structure", `file-${i}`)
    );

    return result;
  }, [directories, technologies, languages, files]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">
          Interactive Repository Map
        </h2>
        <p className="text-sm text-slate-500">
          Explore the repository structure and its connections.
        </p>
      </div>

      <div className="relative h-[680px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.15}
          maxZoom={2}
          onNodeClick={(_, node) => setSelected(node.data)}
          onPaneClick={() => setSelected(null)}
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>

        {selected && (
          <div className="absolute right-4 top-4 z-10 w-64 rounded-xl border bg-white p-4 shadow-lg">
            <button
              onClick={() => setSelected(null)}
              className="float-right"
              aria-label="Close details"
            >
              ✕
            </button>
            <p className="text-xs font-semibold uppercase text-violet-600">
              {selected.category}
            </p>
            <h3 className="mt-2 font-bold">{selected.label}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {selected.description}
            </p>
            {selected.details?.map((detail) => (
              <p key={detail} className="mt-2 text-xs text-slate-500">
                {detail}
              </p>
            ))}
          </div>
        )}
      </div>

      <p className="border-t px-5 py-3 text-xs text-slate-500">
        Drag nodes to rearrange. Zoom and pan the canvas. Select nodes to inspect details.
      </p>
    </div>
  );
}

export default function InteractiveRepositoryMap(props: Props) {
  return (
    <ReactFlowProvider>
      <MapContent {...props} />
    </ReactFlowProvider>
  );
}
