
import base64
import math
import re
from collections import Counter

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

app = FastAPI(
    title="RepoMind API",
    description="AI-powered GitHub Repository Analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GITHUB_API = "https://api.github.com"

STOP_WORDS = {
    "the", "and", "for", "are", "with", "this", "that", "from",
    "you", "your", "can", "will", "has", "have", "was", "were",
    "into", "using", "use", "used", "its", "our", "their", "they",
    "them", "how", "what", "when", "where", "which", "who",
    "about", "also", "not", "but", "all", "any", "more", "than",
    "such", "each", "other", "been", "being", "these", "those",
    "should", "would", "could", "may", "might", "must", "get",
    "set", "run", "new", "one", "two", "some", "very",
}


class AnalyzeRequest(BaseModel):
    repo_url: HttpUrl


def extract_sentences(text: str):
    cleaned = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    cleaned = re.sub(r"!\[.*?\]\(.*?\)", " ", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)

    sentences = re.split(r"(?<=[.!?])\s+|\n+", cleaned)

    return [
        sentence.strip()
        for sentence in sentences
        if len(sentence.strip()) > 35
        and not sentence.strip().startswith("#")
    ]


def summarize_readme(readme: str):
    sentences = extract_sentences(readme)

    if not sentences:
        return []

    documents = []

    for sentence in sentences:
        words = re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]*", sentence.lower())
        documents.append([
            word for word in words
            if word not in STOP_WORDS and len(word) > 2
        ])

    document_frequency = Counter()

    for words in documents:
        document_frequency.update(set(words))

    total_documents = len(documents)
    scores = []

    for index, words in enumerate(documents):
        if not words:
            continue

        word_counts = Counter(words)
        score = 0

        for word, count in word_counts.items():
            tf = count / len(words)
            idf = math.log(
                (1 + total_documents) /
                (1 + document_frequency[word])
            ) + 1

            score += tf * idf

        score = score / math.sqrt(len(words))
        scores.append((score, index, sentences[index]))

    ranked = sorted(scores, reverse=True)
    selected = ranked[:5]
    selected = sorted(selected, key=lambda item: item[1])

    return [item[2] for item in selected]


def detect_technologies(languages, files):
    technologies = set(languages.keys())

    indicators = {
        "package.json": "Node.js",
        "requirements.txt": "Python",
        "pyproject.toml": "Python",
        "pom.xml": "Java / Maven",
        "build.gradle": "Java / Gradle",
        "Cargo.toml": "Rust",
        "go.mod": "Go",
        "Dockerfile": "Docker",
        "docker-compose.yml": "Docker Compose",
        "next.config.js": "Next.js",
        "next.config.ts": "Next.js",
        "vite.config.ts": "Vite",
        "tsconfig.json": "TypeScript",
    }

    for file in files:
        if file in indicators:
            technologies.add(indicators[file])

    return sorted(technologies)


async def github_get(client, endpoint):
    response = await client.get(f"{GITHUB_API}{endpoint}")

    if response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail="Repository not found or it is private.",
        )

    if response.status_code == 403:
        raise HTTPException(
            status_code=429,
            detail="GitHub API rate limit reached. Please try again later.",
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail="Unable to retrieve repository information from GitHub.",
        )

    return response.json()


@app.get("/")
async def root():
    return {
        "message": "Welcome to RepoMind API",
        "status": "running",
        "version": "1.0.0",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/analyze")
async def analyze_repository(request: AnalyzeRequest):
    parsed = request.repo_url

    if parsed.host != "github.com":
        raise HTTPException(
            status_code=400,
            detail="Only github.com repository URLs are supported.",
        )

    parts = parsed.path.strip("/").split("/")

    if len(parts) != 2 or not all(parts):
        raise HTTPException(
            status_code=400,
            detail="Enter a repository URL in the format github.com/owner/repository.",
        )

    owner, repo = parts
    repo = repo.removesuffix(".git")

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RepoMind-Repository-Analyzer",
    }

    async with httpx.AsyncClient(
        timeout=30.0,
        headers=headers,
        follow_redirects=True,
    ) as client:

        repository = await github_get(
            client,
            f"/repos/{owner}/{repo}",
        )

        default_branch = repository["default_branch"]
        readme = ""

        try:
            readme_data = await github_get(
                client,
                f"/repos/{owner}/{repo}/readme",
            )

            if readme_data.get("encoding") == "base64":
                readme = base64.b64decode(
                    readme_data["content"]
                ).decode("utf-8", errors="replace")

        except HTTPException as error:
            if error.status_code != 404:
                raise

        languages = await github_get(
            client,
            f"/repos/{owner}/{repo}/languages",
        )

        tree_data = await github_get(
            client,
            f"/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1",
        )

    tree = tree_data.get("tree", [])

    files = [
        item["path"]
        for item in tree
        if item.get("type") == "blob"
    ]

    directories = sorted({
        item["path"].split("/")[0]
        for item in tree
        if item.get("type") == "tree"
        and "/" not in item["path"]
    })

    technologies = detect_technologies(languages, files)
    key_points = summarize_readme(readme)

    explanation = (
        f"{repository['name']} is a GitHub repository "
        f"created by {repository['owner']['login']}. "
    )

    if repository.get("description"):
        explanation += repository["description"] + " "

    if technologies:
        explanation += (
            "The repository uses the following technologies: "
            + ", ".join(technologies) + ". "
        )

    explanation += (
        f"The default branch is {default_branch}. "
        f"The repository contains {len(files)} files "
        f"and {len(directories)} top-level directories."
    )

    return {
        "success": True,
        "repository": {
            "name": repository["name"],
            "full_name": repository["full_name"],
            "owner": repository["owner"]["login"],
            "description": repository.get("description"),
            "url": repository["html_url"],
            "stars": repository["stargazers_count"],
            "forks": repository["forks_count"],
            "open_issues": repository["open_issues_count"],
            "default_branch": default_branch,
            "created_at": repository["created_at"],
            "updated_at": repository["updated_at"],
            "license": (
                repository.get("license") or {}
            ).get("name"),
        },
        "languages": languages,
        "technologies": technologies,
        "structure": {
            "total_files": len(files),
            "total_directories": len(directories),
            "directories": directories[:30],
            "files": files[:100],
            "truncated": tree_data.get("truncated", False),
        },
        "readme": {
            "available": bool(readme),
            "content": readme[:12000],
            "key_points": key_points,
        },
        "ai_analysis": {
            "method": "TF-IDF-based extractive NLP and repository metadata analysis",
            "explanation": explanation,
            "summary_points": key_points,
        },
    }
