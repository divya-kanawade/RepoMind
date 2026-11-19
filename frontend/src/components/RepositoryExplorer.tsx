
"use client";

import { useMemo, useState } from "react";

export type RepositoryTreeEntry = {
  path: string;
  type: "blob" | "tree";
  size: number | null;
};

type TreeNode = {
  name: string;
  path: string;
  type: "blob" | "tree";
  size: number | null;
  children: TreeNode[];
};

type RepositoryExplorerProps = {
  tree: RepositoryTreeEntry[];
  totalFiles: number;
  totalDirectories: number;
  truncated?: boolean;
};

function buildTree(entries: RepositoryTreeEntry[]): TreeNode[] {
  const root: TreeNode = {
    name: "",
    path: "",
    type: "tree",
    size: null,
    children: [],
  };

  const sorted = [...entries].sort((a, b) => {
    if (a.path.split("/").length !== b.path.split("/").length) {
      return a.path.split("/").length - b.path.split("/").length;
    }
    return a.path.localeCompare(b.path);
  });

  for (const entry of sorted) {
    const parts = entry.path.split("/").filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      const isLast = index === parts.length - 1;
      const type = isLast ? entry.type : "tree";

      let child = current.children.find((item) => item.name === part);

      if (!child) {
        child = {
          name: part,
          path,
          type,
          size: isLast ? entry.size : null,
          children: [],
        };
        current.children.push(child);
      } else if (isLast) {
        child.type = type;
        child.size = entry.size;
      }

      current = child;
    });
  }

  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    nodes.forEach((node) => sortNodes(node.children));
  }

  sortNodes(root.children);
  return root.children;
}

function formatSize(size: number | null): string {
  if (size === null || size === undefined) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileIcon(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase();

  const icons: Record<string, string> = {
    ts: "TS",
    tsx: "TSX",
    js: "JS",
    jsx: "JSX",
    py: "PY",
    json: "{}",
    md: "MD",
    css: "#",
    html: "HTML",
    yml: "YML",
    yaml: "YML",
    svg: "SVG",
    png: "IMG",
    jpg: "IMG",
    jpeg: "IMG",
    sql: "SQL",
    java: "JAVA",
    xml: "XML",
    sh: "SH",
    env: "ENV",
  };

  return icons[extension || ""] || "FILE";
}

export default function RepositoryExplorer({
  tree,
  totalFiles,
  totalDirectories,
  truncated = false,
}: RepositoryExplorerProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState("");
  const [showAll, setShowAll] = useState(false);

  const nodes = useMemo(() => buildTree(tree), [tree]);

  const filteredPaths = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return null;

    return new Set(
      tree
        .filter((entry) => entry.path.toLowerCase().includes(query))
        .flatMap((entry) => {
          const parts = entry.path.split("/");
          return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
        })
    );
  }, [tree, search]);

  const toggleFolder = (path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(tree.filter((entry) => entry.type === "tree").map((entry) => entry.path)));
  };

  const collapseAll = () => setExpanded(new Set());

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(tree, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "repository-structure.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const visibleNodes = useMemo(() => {
    function limit(
      items: TreeNode[],
      remaining: number
    ): { result: TreeNode[]; remaining: number } {
      const result: TreeNode[] = [];
      let available = remaining;

      for (const node of items) {
        if (!showAll && available <= 0) break;

        available -= 1;

        let children: TreeNode[] = [];

        if (
          node.type === "tree" &&
          (expanded.has(node.path) || filteredPaths?.has(node.path))
        ) {
          const childResult = limit(node.children, available);
          children = childResult.result;
          available = childResult.remaining;
        }

        result.push({ ...node, children });
      }

      return { result, remaining: available };
    }

    return limit(nodes, showAll ? Number.MAX_SAFE_INTEGER : 2000).result;
  }, [nodes, expanded, filteredPaths, showAll]);

  function renderNodes(items: TreeNode[], depth = 0): React.ReactNode {
    return items.map((node) => {
      const isExpanded =
        expanded.has(node.path) || Boolean(filteredPaths?.has(node.path));
      const isSelected = selectedPath === node.path;
      const hasChildren = node.children.length > 0;

      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() =>
              node.type === "tree"
                ? toggleFolder(node.path)
                : setSelectedPath(node.path)
            }
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
              isSelected
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            <span className="w-4 text-center text-xs text-gray-400">
              {node.type === "tree"
                ? isExpanded
                  ? "▾"
                  : "▸"
                : ""}
            </span>

            <span className="w-10 shrink-0 rounded bg-gray-100 px-1 py-0.5 text-center text-[9px] font-semibold text-gray-500">
              {node.type === "tree" ? "DIR" : getFileIcon(node.name)}
            </span>

            <span className="min-w-0 flex-1 truncate">
              {node.name}
            </span>

            <span className="shrink-0 text-xs text-gray-400">
              {node.type === "blob" ? formatSize(node.size) : ""}
            </span>
          </button>

          {node.type === "tree" && isExpanded && hasChildren && (
            <div>{renderNodes(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  }

  const selectedEntry = tree.find((entry) => entry.path === selectedPath);

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Repository Explorer
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Explore the complete folder and file hierarchy.
          </p>
        </div>

        <button
          type="button"
          onClick={exportJSON}
          disabled={tree.length === 0}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Export JSON ↓
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Files</p>
          <p className="text-xl font-semibold text-gray-900">{totalFiles}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Directories</p>
          <p className="text-xl font-semibold text-gray-900">
            {totalDirectories}
          </p>
        </div>
        <div className="col-span-2 rounded-lg bg-gray-50 p-3 sm:col-span-1">
          <p className="text-xs text-gray-500">Indexed entries</p>
          <p className="text-xl font-semibold text-gray-900">{tree.length}</p>
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search files and folders..."
        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={expandAll}
          className="rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          Collapse all
        </button>
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          {showAll ? "Limit visible entries" : "Show all entries"}
        </button>
      </div>

      {truncated && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          GitHub limited the recursive tree response or RepoMind reached its
          10,000-entry limit. This explorer shows the entries returned by the
          API.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="max-h-[560px] min-h-40 overflow-auto rounded-lg border border-gray-200 p-2">
          {tree.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              No repository structure available.
            </p>
          ) : visibleNodes.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              No matching files or folders.
            </p>
          ) : (
            renderNodes(visibleNodes)
          )}
        </div>

        <aside className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Selected item
          </h3>

          {selectedEntry ? (
            <div className="mt-4 space-y-3">
              <p className="break-all text-sm font-medium text-gray-800">
                {selectedEntry.path}
              </p>
              <div className="text-xs text-gray-500">
                Type: {selectedEntry.type === "tree" ? "Folder" : "File"}
              </div>
              {selectedEntry.type === "blob" && (
                <div className="text-xs text-gray-500">
                  Size: {formatSize(selectedEntry.size)}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              Select a file to inspect its details.
            </p>
          )}
        </aside>
      </div>

      <p className="text-xs text-gray-400">
        Showing up to 2,000 visible entries initially. Expand folders or use
        search to navigate larger repositories.
      </p>
    </section>
  );
}
