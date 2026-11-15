
"use client";

import MermaidDiagram from "./MermaidDiagram";

type Dependency = {
  source: string;
  target: string;
  specifier: string;
  line: number;
  language: string;
  verified: boolean;
};

type RepositoryVisualizationsProps = {
  repositoryName: string;
  technologies: string[];
  languages: Record<string, number>;
  directories: string[];
  files: string[];
  dependencies: Dependency[];
};

type FileNode = {
  name: string;
  children: Map<string, FileNode>;
};

function safeLabel(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9 ._+#/()-]/g, " ")
      .trim()
      .slice(0, 65) || "Unknown"
  );
}

function createArchitectureDiagram(
  repositoryName: string,
  technologies: string[],
  directories: string[]
): string {
  const lines = [
    "flowchart TD",
    `Repo["${safeLabel(repositoryName)}"]`,
    'Repo --> Stack["Technology Stack"]',
  ];

  const detected = technologies.length
    ? technologies.slice(0, 12)
    : ["No technologies detected"];

  detected.forEach((technology, index) => {
    lines.push(
      `Stack --> Tech${index}["${safeLabel(technology)}"]`
    );
  });

  if (directories.length > 0) {
    lines.push('Repo --> Structure["Project Structure"]');

    directories.slice(0, 10).forEach((directory, index) => {
      lines.push(
        `Structure --> Dir${index}["${safeLabel(directory)}"]`
      );
    });
  }

  return lines.join("\n");
}

function createDependencyDiagram(
  dependencies: Dependency[]
): string {
  const verified = dependencies.filter(
    (dependency) => dependency.verified
  );

  const selected = verified.slice(0, 40);

  if (selected.length === 0) {
    return `flowchart TD
      Empty["No verified local dependencies found"]
      Note["No matching local import relationships were detected"]
      Empty --> Note`;
  }

  const lines = ["flowchart LR"];
  const nodeIds = new Map<string, string>();
  let nextId = 0;

  function getNodeId(path: string): string {
    if (!nodeIds.has(path)) {
      const id = `File${nextId++}`;
      nodeIds.set(path, id);

      lines.push(
        `${id}["${safeLabel(path)}"]`
      );
    }

    return nodeIds.get(path)!;
  }

  selected.forEach((dependency) => {
    const sourceId = getNodeId(dependency.source);
    const targetId = getNodeId(dependency.target);

    lines.push(
      `${sourceId} -->|"Line ${dependency.line}"| ${targetId}`
    );
  });

  if (verified.length > selected.length) {
    lines.push(
      `More["${verified.length - selected.length} additional connections omitted"]`
    );
  }

  return lines.join("\n");
}

function createFileTreeDiagram(
  repositoryName: string,
  directories: string[],
  files: string[]
): string {
  const root: FileNode = {
    name: repositoryName,
    children: new Map(),
  };

  const allPaths = [...new Set([...directories, ...files])];

  allPaths.slice(0, 100).forEach((path) => {
    const parts = path.split("/").filter(Boolean);
    let current = root;

    parts.forEach((part) => {
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          children: new Map(),
        });
      }

      current = current.children.get(part)!;
    });
  });

  const lines = [
    "flowchart TD",
    `N0["${safeLabel(repositoryName)}"]`,
  ];

  let nextId = 1;
  let nodeCount = 1;

  function addChildren(
    parent: FileNode,
    parentId: string,
    depth: number
  ) {
    if (depth > 5 || nodeCount >= 50) return;

    for (const child of parent.children.values()) {
      if (nodeCount >= 50) break;

      const id = `N${nextId++}`;
      nodeCount++;

      lines.push(
        `${parentId} --> ${id}["${safeLabel(child.name)}"]`
      );

      addChildren(child, id, depth + 1);
    }
  }

  addChildren(root, "N0", 0);

  if (nodeCount === 1) {
    lines.push('N0 --> Empty["No file paths available"]');
  }

  if (allPaths.length > 100 || nodeCount >= 50) {
    lines.push(
      'N0 --> More["Additional files omitted from diagram"]'
    );
  }

  return lines.join("\n");
}

export default function RepositoryVisualizations({
  repositoryName,
  technologies,
  languages,
  directories,
  files,
  dependencies,
}: RepositoryVisualizationsProps) {
  const architecture = createArchitectureDiagram(
    repositoryName,
    technologies,
    directories
  );

  const dependencyDiagram = createDependencyDiagram(
    dependencies
  );

  const fileTree = createFileTreeDiagram(
    repositoryName,
    directories,
    files
  );

  const verifiedCount = dependencies.filter(
    (dependency) => dependency.verified
  ).length;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#0969da]">
          VISUAL INTELLIGENCE
        </p>

        <h2 className="mt-1 text-xl font-bold">
          Repository Visualizations
        </h2>

        <p className="mt-2 text-sm text-[#656d76]">
          Explore repository structure and actual code relationships.
        </p>
      </div>

      <MermaidDiagram
        title="Repository Architecture"
        description="Technology and directory overview generated from repository metadata."
        chart={architecture}
      />

      <MermaidDiagram
        title="Repository File Dependency Graph"
        description={`${verifiedCount} verified local file dependencies detected. Showing up to 40 connections.`}
        chart={dependencyDiagram}
      />

      <MermaidDiagram
        title="Repository File Structure"
        description="Visual representation of detected folders and files."
        chart={fileTree}
      />

      <p className="text-xs text-[#656d76]">
        Dependency connections are resolved from actual source-code
        imports. Only verified local file relationships are displayed.
      </p>
    </section>
  );
}
