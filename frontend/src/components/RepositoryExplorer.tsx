
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
  repositoryName?: string;
};

function buildTree(entries: RepositoryTreeEntry[]): TreeNode[] {
  const root: TreeNode = {
    name: "",
    path: "",
    type: "tree",
    size: null,
    children: [],
  };

  const sorted = [...entries].sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  for (const entry of sorted) {
    const parts = entry.path.split("/").filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      const isLast = index === parts.length - 1;
      const type = isLast ? entry.type : "tree";

      let child = current.children.find(
        (item) => item.name === part
      );

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
      if (a.type !== b.type) {
        return a.type === "tree" ? -1 : 1;
      }
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
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function RepositoryExplorer({
  tree,
  totalFiles,
  totalDirectories,
  truncated = false,
  repositoryName = "Repository",
}: RepositoryExplorerProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set()
  );
  const [selectedPath, setSelectedPath] = useState("");

  const nodes = useMemo(() => buildTree(tree), [tree]);

  const filteredNodes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return nodes;

    function filter(items: TreeNode[]): TreeNode[] {
      return items
        .map((node) => {
          const children = filter(node.children);
          const matches =
            node.name.toLowerCase().includes(query) ||
            node.path.toLowerCase().includes(query);

          if (!matches && children.length === 0) return null;

          return {
            ...node,
            children,
          };
        })
        .filter((node): node is TreeNode => node !== null);
    }

    return filter(nodes);
  }, [nodes, search]);

  const allFolders = useMemo(() => {
    const paths: string[] = [];

    function collect(items: TreeNode[]) {
      items.forEach((node) => {
        if (node.type === "tree") {
          paths.push(node.path);
          collect(node.children);
        }
      });
    }

    collect(nodes);
    return paths;
  }, [nodes]);

  const toggleFolder = (path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);

      if (next.has(path)) next.delete(path);
      else next.add(path);

      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(allFolders));
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  const exportJSON = () => {
    const blob = new Blob(
      [JSON.stringify(tree, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "repository-file-structure.json";
    link.click();

    URL.revokeObjectURL(url);
  };

  const selectedEntry = tree.find(
    (entry) => entry.path === selectedPath
  );

  function renderNodes(
    items: TreeNode[],
    prefix = ""
  ): React.ReactNode {
    return items.map((node, index) => {
      const isLast = index === items.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const nextPrefix = prefix + (isLast ? "    " : "│   ");
      const isExpanded =
        expanded.has(node.path) || search.trim().length > 0;
      const isSelected = selectedPath === node.path;
      const hasChildren = node.children.length > 0;

      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => {
              if (node.type === "tree") {
                toggleFolder(node.path);
              } else {
                setSelectedPath(node.path);
              }
            }}
            className={`group flex w-full items-center rounded-md px-2 py-1.5 text-left font-mono text-[13px] transition ${
              isSelected
                ? "bg-blue-500/20 text-blue-200"
                : "text-slate-200 hover:bg-white/10"
            }`}
          >
            <span className="whitespace-pre text-slate-500">
              {prefix + connector}
            </span>

            <span className="mr-2">
              {node.type === "tree" ? "📁" : "📄"}
            </span>

            <span className="min-w-0 flex-1 break-all">
              {node.name}
              {node.type === "tree" ? "/" : ""}
            </span>

            {node.type === "tree" && (
              <span className="ml-2 text-[10px] text-slate-500">
                {isExpanded ? "−" : "+"}
              </span>
            )}

            {node.type === "blob" && (
              <span className="ml-3 shrink-0 text-[10px] text-slate-500">
                {formatSize(node.size)}
              </span>
            )}
          </button>

          {node.type === "tree" &&
            isExpanded &&
            hasChildren && (
              <div>
                {renderNodes(node.children, nextPrefix)}
              </div>
            )}
        </div>
      );
    });
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            File Structure
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Repository hierarchy
          </p>
        </div>

        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          ● Interactive
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xl">📁</span>
          <span className="truncate text-sm font-semibold text-slate-800">
            {repositoryName}
          </span>
        </div>

        <span className="text-xs text-slate-500">
          {totalFiles.toLocaleString()} files ·{" "}
          {totalDirectories.toLocaleString()} directories
        </span>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search files and folders..."
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={expandAll}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Expand all
        </button>

        <button
          type="button"
          onClick={collapseAll}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Collapse all
        </button>

        <button
          type="button"
          onClick={exportJSON}
          disabled={tree.length === 0}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Export JSON ↓
        </button>
      </div>

      {truncated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          The repository tree was limited by GitHub or the
          analysis entry limit. Only the returned entries are
          displayed.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-h-[360px] max-h-[620px] overflow-auto rounded-xl border border-slate-700 bg-[#17191f] p-4 shadow-inner">
          <div className="mb-4 flex items-center justify-between border-b border-slate-700 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>

            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Repository tree
            </span>
          </div>

          <button
            type="button"
            onClick={expandAll}
            className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-sm font-semibold text-white hover:bg-white/10"
          >
            📁 {repositoryName}/
          </button>

          {filteredNodes.length > 0 ? (
            <div>{renderNodes(filteredNodes)}</div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              {tree.length === 0
                ? "No repository structure available."
                : "No matching files or folders."}
            </p>
          )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold text-slate-800">
            File details
          </h3>

          {selectedEntry ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-slate-500">Path</p>
                <p className="mt-1 break-all text-sm font-medium text-slate-800">
                  {selectedEntry.path}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Type</p>
                <p className="mt-1 text-sm text-slate-800">
                  {selectedEntry.type === "tree" ? "📁 Directory" : "📄 File"}
                </p>
              </div>

              {selectedEntry.type === "blob" && (
                <>
                  <div>
                    <p className="text-xs text-slate-500">File size</p>
                    <p className="mt-1 text-sm text-slate-800">
                      {formatSize(selectedEntry.size)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Extension</p>
                    <p className="mt-1 text-sm text-slate-800">
                      {selectedEntry.path.includes(".")
                        ? `.${selectedEntry.path.split(".").pop()}`
                        : "No extension"}
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Select a file from the repository tree to inspect
              its path, type, size, and extension.
            </p>
          )}
        </aside>
      </div>

      <p className="text-xs text-slate-400">
        Select folders to expand or collapse them. Select files
        to inspect their details. Search to locate entries in
        the repository.
      </p>
    </section>
  );
}
