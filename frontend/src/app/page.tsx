
"use client";

import { useState } from "react";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");

  function handleAnalyze(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const value = repoUrl.trim().replace(/\/+$/, "");
    const valid = /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/.test(value);

    if (!valid) {
      setMessage("Enter a valid GitHub repository URL, for example https://github.com/vercel/next.js");
      setMessageType("error");
      return;
    }

    setRepoUrl(value);
    setMessage("Repository URL accepted. Repository analysis will be connected in the next step.");
    setMessageType("success");
  }

  return (
    <main className="min-h-screen bg-[#f6f8fa] text-[#1f2328]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[245px] shrink-0 flex-col border-r border-[#d1d9e0] bg-white md:flex">
          <div className="flex h-[68px] items-center gap-3 border-b border-[#d1d9e0] px-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#24292f] text-sm font-bold text-white">
              R
            </div>
            <span className="text-lg font-semibold tracking-tight">RepoMind</span>
          </div>

          <div className="px-4 py-6">
            <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#656d76]">
              Workspace
            </p>

            <a
              href="#dashboard"
              className="mb-1 flex items-center gap-3 rounded-md bg-[#ddf4ff] px-3 py-2.5 text-sm font-semibold text-[#0969da]"
            >
              <span>▦</span>
              Dashboard
            </a>

            <a
              href="#analyze"
              className="mb-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-[#59636e] transition hover:bg-[#f6f8fa]"
            >
              <span>⌕</span>
              Analyze repository
            </a>

            <a
              href="#history"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-[#59636e] transition hover:bg-[#f6f8fa]"
            >
              <span>◷</span>
              Analysis history
            </a>
          </div>

          <div className="mt-auto border-t border-[#d1d9e0] p-5">
            <div className="rounded-lg border border-[#d1d9e0] bg-[#f6f8fa] p-3">
              <p className="text-xs font-semibold">RepoMind</p>
              <p className="mt-1 text-xs leading-5 text-[#656d76]">
                Understand repositories. Explore code. Learn faster.
              </p>
              <p className="mt-3 text-[10px] text-[#656d76]">MCA Project · AI/ML</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1" id="dashboard">
          <header className="flex h-[68px] items-center justify-between border-b border-[#d1d9e0] bg-white px-5 sm:px-9">
            <div>
              <p className="text-sm font-semibold">Developer Workspace</p>
              <p className="text-xs text-[#656d76]">Repository intelligence platform</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden rounded-full border border-[#d1d9e0] px-3 py-1.5 text-xs text-[#59636e] sm:inline-block">
                AI / ML
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ddf4ff] text-xs font-semibold text-[#0969da]">
                RM
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-5 py-9 sm:px-9 sm:py-12">
            <div className="mb-9">
              <p className="mb-2 text-sm text-[#656d76]">Workspace / Dashboard</p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Repository dashboard
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#656d76]">
                Analyze a GitHub repository and understand how its codebase is organized.
              </p>
            </div>

            <section
              id="analyze"
              className="rounded-xl border border-[#d1d9e0] bg-white p-5 shadow-sm sm:p-7"
            >
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d1d9e0] bg-[#f6f8fa] text-lg">
                  ↗
                </div>
                <div>
                  <h2 className="font-semibold">Analyze a repository</h2>
                  <p className="mt-1 text-sm text-[#656d76]">
                    Start by providing a public GitHub repository URL.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAnalyze}>
                <label
                  htmlFor="repository"
                  className="mb-2 block text-sm font-medium"
                >
                  Repository URL
                </label>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="repository"
                    type="url"
                    value={repoUrl}
                    onChange={(e) => {
                      setRepoUrl(e.target.value);
                      setMessage("");
                    }}
                    placeholder="https://github.com/owner/repository"
                    className="h-11 min-w-0 flex-1 rounded-md border border-[#d1d9e0] bg-white px-3 text-sm outline-none transition placeholder:text-[#9198a1] focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/15"
                  />

                  <button
                    type="submit"
                    className="h-11 rounded-md bg-[#1f883d] px-6 text-sm font-semibold text-white transition hover:bg-[#1a7f37] focus:outline-none focus:ring-2 focus:ring-[#1f883d]/30"
                  >
                    Analyze repository →
                  </button>
                </div>

                {message && (
                  <p
                    role="status"
                    className={`mt-3 text-sm ${
                      messageType === "error" ? "text-[#cf222e]" : "text-[#1a7f37]"
                    }`}
                  >
                    {message}
                  </p>
                )}

                <p className="mt-3 text-xs text-[#656d76]">
                  Currently supports public GitHub repositories.
                </p>
              </form>
            </section>

            <section className="mt-9">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">Analysis capabilities</h2>
                <span className="text-xs text-[#656d76]">Project overview</span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    number: "01",
                    title: "Repository structure",
                    description:
                      "Inspect folders, files, project metadata and documentation.",
                  },
                  {
                    number: "02",
                    title: "Code understanding",
                    description:
                      "Generate explanations of source code using AI-based analysis.",
                  },
                  {
                    number: "03",
                    title: "Ask questions",
                    description:
                      "Explore a codebase by asking questions about its implementation.",
                  },
                ].map((item) => (
                  <article
                    key={item.number}
                    className="rounded-xl border border-[#d1d9e0] bg-white p-5 shadow-sm"
                  >
                    <p className="mb-5 text-xs font-semibold text-[#0969da]">
                      {item.number}
                    </p>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#656d76]">
                      {item.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section
              id="history"
              className="mt-9 rounded-xl border border-dashed border-[#afb8c1] bg-white px-5 py-10 text-center"
            >
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#f6f8fa] text-xl text-[#656d76]">
                ◷
              </div>
              <h2 className="text-sm font-semibold">No analyses yet</h2>
              <p className="mt-2 text-sm text-[#656d76]">
                Your repository analysis history will appear here.
              </p>
            </section>

            <footer className="mt-12 border-t border-[#d1d9e0] pt-5 text-xs text-[#656d76]">
              RepoMind · AI-powered GitHub repository analysis
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
