
"use client";

import MermaidDiagram from "./MermaidDiagram";

type RepositoryVisualizationsProps = {
  repositoryName: string;
  technologies: string[];
  languages: Record<string, number>;
  directories: string[];
  files: string[];
};

type FileNode = {
  name: string;
  children: Map<string, FileNode>;
};

function safeLabel(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9 ._+#/()-]/g, " ")
    .trim()
    .slice(0, 65) || "Unknown";
}

function createArchitectureDiagram(
  repositoryName: string,
  technologies: string[],
  directories: string[]
): string {
  const lines = [
    "flowchart TD",
    `  Repo["${safeLabel(repositoryName)}"]`,
    '  Repo --> Stack["Technology Stack"]',
  ];

  const detected = technologies.length
    ? technologies.slice(0, 12)
    : ["No technologies detected"];

  detected.forEach((technology, index) => {
    lines.push(`  Stack --> Tech${index}["${safeLabel(technology)}"]`);
  });

  if (directories.length > 0) {
    lines.push('  Repo --> Structure["Project Structure"]');

    directories.slice(0, 10).forEach((directory, index) => {
      lines.push(
        `  Structure --> Dir${index}["${safeLabel(directory)}"]`
      );
    });
  }

  return lines.join("\n");
}

function createFlowchart(): string {
  return `flowchart TD
    A["Enter GitHub Repository URL"] --> B["Validate Repository URL"]
    B --> C["Connect to GitHub API"]
    C --> D["Fetch Repository Metadata"]
    D --> E["Retrieve README"]
    D --> F["Retrieve Languages"]
    D --> G["Retrieve File Structure"]
    E --> H["Process Repository Information"]
    F --> H
    G --> H
    H --> I["Detect Technologies"]
    H --> J["Extract README Key Points"]
    I --> K["Generate Analysis Results"]
    J --> K
    K --> L["Display Dashboard and Visualizations"]`;
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

  const lines = ["flowchart TD", `  N0["${safeLabel(repositoryName)}"]`];

  let nextId = 1;
  let nodeCount = 1;

  function addChildren(parent: FileNode, parentId: string, depth: number) {
    if (depth > 5 || nodeCount >= 50) return;

    for (const child of parent.children.values()) {
      if (nodeCount >= 50) break;

      const id = `N${nextId++}`;
      nodeCount++;

      lines.push(
        `  ${parentId} --> ${id}["${safeLabel(child.name)}"]`
      );

      addChildren(child, id, depth + 1);
    }
  }

  addChildren(root, "N0", 0);

  if (nodeCount === 1) {
    lines.push('  N0 --> Empty["No file paths available"]');
  }

  if (allPaths.length > 100 || nodeCount >= 50) {
    lines.push('  N0 --> More["Additional files omitted from diagram"]');
  }

  return lines.join("\n");
}

export default function RepositoryVisualizations({
  repositoryName,
  technologies,
  languages,
  directories,
  files,
}: RepositoryVisualizationsProps) {
  const architecture = createArchitectureDiagram(
    repositoryName,
    technologies,
    directories
  );

  const flowchart = createFlowchart();

  const fileTree = createFileTreeDiagram(
    repositoryName,
    directories,
    files
  );

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
          Explore the repository through automatically generated diagrams.
        </p>
      </div>

      <MermaidDiagram
        title="Repository Architecture"
        description="A technology and directory overview generated from repository metadata."
        chart={architecture}
      />

      <MermaidDiagram
        title="Repository Analysis Flowchart"
        description="Understand how RepoMind processes a GitHub repository."
        chart={flowchart}
      />

      <MermaidDiagram
        title="Repository File Structure"
        description="A visual representation of the detected folders and files."
        chart={fileTree}
      />

      <p className="text-xs text-[#656d76]">
        Diagrams are generated from the available repository metadata.
        The architecture view is an overview, not a verified runtime
        dependency map.
      </p>
    </section>
  );
}
