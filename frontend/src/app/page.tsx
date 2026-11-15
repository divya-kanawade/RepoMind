
"use client";

import { useState } from "react";
import RepositoryVisualizations from "../components/RepositoryVisualizations";

type AnalysisResult = {
  success: boolean;
  repository: {
    name: string;
    full_name: string;
    owner: string;
    description: string | null;
    url: string;
    stars: number;
    forks: number;
    open_issues: number;
    default_branch: string;
    license: string | null;
  };
  languages: Record<string, number>;
  technologies: string[];
  structure: {
    total_files: number;
    total_directories: number;
    directories: string[];
    files: string[];
  };
  readme: {
    available: boolean;
    key_points: string[];
  };
  ai_analysis: {
    method: string;
    explanation: string;
    summary_points: string[];
  };
};

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  async function analyzeRepository() {
    setError("");
    setResult(null);

    const trimmedUrl = repoUrl.trim();

    if (
      !/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/i.test(
        trimmedUrl
      )
    ) {
      setError("Enter a valid public GitHub repository URL.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_url: trimmedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Repository analysis failed.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to RepoMind backend."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fa] text-[#1f2328]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-[#d1d9e0] bg-white p-6 md:block">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#24292f] text-xl font-bold text-white">
              R
            </div>
            <div>
              <h1 className="text-lg font-bold">RepoMind</h1>
              <p className="text-xs text-[#656d76]">
                Repository intelligence
              </p>
            </div>
          </div>

          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#656d76]">
            Workspace
          </p>

          <nav className="space-y-2">
            <div className="rounded-lg bg-[#ddf4ff] px-3 py-2.5 text-sm font-semibold text-[#0969da]">
              <span className="mr-2">▦</span> Overview
            </div>
            <div className="rounded-lg px-3 py-2.5 text-sm text-[#656d76]">
              <span className="mr-2">⌕</span> Repository Analysis
            </div>
            <div className="rounded-lg px-3 py-2.5 text-sm text-[#656d76]">
              <span className="mr-2">◷</span> Analysis History
            </div>
          </nav>

          <div className="mt-10 rounded-xl border border-[#d1d9e0] bg-[#f6f8fa] p-4">
            <p className="text-sm font-semibold">About RepoMind</p>
            <p className="mt-2 text-xs leading-5 text-[#656d76]">
              Understand public GitHub repositories through automated code
              structure analysis and natural language processing.
            </p>
          </div>

          <div className="mt-auto pt-10 text-xs text-[#656d76]">
            MCA Capstone Project
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex h-16 items-center justify-between border-b border-[#d1d9e0] bg-white px-5 md:px-10">
            <p className="text-sm text-[#656d76]">
              Workspace <span className="mx-2">/</span>
              <span className="font-semibold text-[#1f2328]">Overview</span>
            </p>
            <div className="rounded-full border border-[#d1d9e0] px-3 py-1.5 text-xs font-medium">
              Public repositories
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">
            <div className="mb-9">
              <p className="mb-2 text-sm font-medium text-[#0969da]">
                DEVELOPER WORKSPACE
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Understand any repository.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#656d76]">
                Explore repository architecture, discover technologies, and
                understand project documentation using intelligent analysis.
              </p>
            </div>

            <section className="rounded-xl border border-[#d1d9e0] bg-white p-5 shadow-sm md:p-7">
              <div className="mb-5">
                <h3 className="text-base font-semibold">
                  Analyze a GitHub repository
                </h3>
                <p className="mt-1 text-sm text-[#656d76]">
                  Paste the URL of any public GitHub repository to get started.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="flex flex-1 items-center rounded-lg border border-[#d1d9e0] bg-white px-3 focus-within:border-[#0969da] focus-within:ring-2 focus-within:ring-[#ddf4ff]">
                  <span className="mr-2 text-[#656d76]">⌕</span>
                  <input
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !loading) {
                        analyzeRepository();
                      }
                    }}
                    placeholder="https://github.com/owner/repository"
                    className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-[#8c959f]"
                  />
                </div>

                <button
                  onClick={analyzeRepository}
                  disabled={loading}
                  className="rounded-lg bg-[#1f883d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1a7f37] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Analyzing..." : "Analyze repository →"}
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-[#ff8182] bg-[#ffebe9] p-3 text-sm text-[#cf222e]">
                  {error}
                </div>
              )}

              <p className="mt-3 text-xs text-[#656d76]">
                <span className="mr-1">ⓘ</span>
                Only public GitHub repositories are supported.
              </p>
            </section>

            {!result && !loading && (
              <>
                <div className="mb-5 mt-10">
                  <h3 className="text-base font-semibold">
                    What you can explore
                  </h3>
                  <p className="mt-1 text-sm text-[#656d76]">
                    Insights generated from repository information.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    {
                      icon: "⌘",
                      title: "Technology detection",
                      description:
                        "Identify programming languages and technologies used in a project.",
                    },
                    {
                      icon: "▤",
                      title: "Project structure",
                      description:
                        "Explore files, folders, and the overall repository organization.",
                    },
                    {
                      icon: "✧",
                      title: "README intelligence",
                      description:
                        "Extract important information from project documentation using NLP.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-xl border border-[#d1d9e0] bg-white p-5"
                    >
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#ddf4ff] text-lg text-[#0969da]">
                        {item.icon}
                      </div>
                      <h4 className="text-sm font-semibold">{item.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-[#656d76]">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {loading && (
              <div className="mt-10 rounded-xl border border-[#d1d9e0] bg-white p-10 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#d1d9e0] border-t-[#0969da]" />
                <h3 className="font-semibold">Analyzing repository...</h3>
                <p className="mt-2 text-sm text-[#656d76]">
                  Fetching GitHub data and processing repository information.
                </p>
              </div>
            )}

            {result && (
              <section className="mt-10 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-[#656d76]">Analysis results</p>
                    <h3 className="mt-1 text-2xl font-bold">
                      {result.repository.full_name}
                    </h3>
                    <p className="mt-2 text-sm text-[#656d76]">
                      {result.repository.description ||
                        "No description available."}
                    </p>
                  </div>
                  <a
                    href={result.repository.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-2 text-sm font-medium hover:bg-[#f6f8fa]"
                  >
                    View on GitHub ↗
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ["Stars", result.repository.stars.toLocaleString()],
                    ["Forks", result.repository.forks.toLocaleString()],
                    [
                      "Open issues",
                      result.repository.open_issues.toLocaleString(),
                    ],
                    ["Total files", result.structure.total_files.toLocaleString()],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-[#d1d9e0] bg-white p-5"
                    >
                      <p className="text-sm text-[#656d76]">{label}</p>
                      <p className="mt-2 text-2xl font-bold">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="rounded-xl border border-[#d1d9e0] bg-white p-5">
                    <h4 className="font-semibold">Technologies detected</h4>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {result.technologies.map((technology) => (
                        <span
                          key={technology}
                          className="rounded-full border border-[#d1d9e0] bg-[#f6f8fa] px-3 py-1.5 text-sm"
                        >
                          {technology}
                        </span>
                      ))}
                    </div>

                    <h5 className="mt-6 text-sm font-semibold">Languages</h5>
                    <div className="mt-3 space-y-2">
                      {Object.entries(result.languages).map(
                        ([language, bytes]) => (
                          <div
                            key={language}
                            className="flex justify-between text-sm"
                          >
                            <span>{language}</span>
                            <span className="text-[#656d76]">
                              {bytes.toLocaleString()} bytes
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#d1d9e0] bg-white p-5">
                    <h4 className="font-semibold">Repository structure</h4>
                    <p className="mt-2 text-sm text-[#656d76]">
                      {result.structure.total_files} files ·{" "}
                      {result.structure.total_directories} top-level directories
                    </p>
                    <div className="mt-4 space-y-2">
                      {result.structure.directories.map((directory) => (
                        <div
                          key={directory}
                          className="rounded-md bg-[#f6f8fa] px-3 py-2 text-sm"
                        >
                          📁 {directory}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <RepositoryVisualizations
                  repositoryName={result.repository.name}
                  technologies={result.technologies}
                  languages={result.languages}
                  directories={result.structure.directories}
                  files={result.structure.files}
                />

                <div className="rounded-xl border border-[#d1d9e0] bg-white p-5">
                  <h4 className="font-semibold">Repository explanation</h4>
                  <p className="mt-3 text-sm leading-7 text-[#656d76]">
                    {result.ai_analysis.explanation}
                  </p>
                  <p className="mt-4 border-t border-[#d1d9e0] pt-3 text-xs text-[#656d76]">
                    Analysis method: {result.ai_analysis.method}
                  </p>
                </div>

                <div className="rounded-xl border border-[#d1d9e0] bg-white p-5">
                  <h4 className="font-semibold">README key points</h4>
                  {result.readme.available ? (
                    <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-[#656d76]">
                      {result.readme.key_points.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-[#656d76]">
                      This repository does not have a README file.
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setResult(null);
                    setRepoUrl("");
                    setError("");
                  }}
                  className="rounded-lg border border-[#d1d9e0] bg-white px-4 py-2 text-sm font-medium hover:bg-[#f6f8fa]"
                >
                  ← Analyze another repository
                </button>
              </section>
            )}

            <footer className="mt-14 border-t border-[#d1d9e0] py-6 text-center text-xs text-[#656d76]">
              RepoMind · Intelligent GitHub Repository Analysis
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
