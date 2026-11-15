import base64
import hashlib
import math
import re
from collections import Counter
from urllib.parse import quote

import chromadb
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from dependency_analyzer import analyze_dependencies


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

app = FastAPI(
    title="RepoMind API",
    description="AI-powered GitHub Repository Analyzer with Local Hybrid RAG",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GITHUB_API = "https://api.github.com"
OLLAMA_BASE = "http://127.0.0.1:11434"
OLLAMA_CHAT = f"{OLLAMA_BASE}/api/chat"
OLLAMA_EMBED = f"{OLLAMA_BASE}/api/embed"

OLLAMA_MODEL = "qwen2.5:1.5b"
EMBED_MODEL = "nomic-embed-text"

CHROMA_PATH = "./chroma_db"
MAX_FILES = 80
MAX_FILE_SIZE = 80000
MAX_CHUNKS = 400
CHUNK_LINES = 80
CHUNK_OVERLAP = 12

chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

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

SOURCE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".kt",
    ".html", ".css", ".scss", ".json", ".xml", ".sql",
    ".md", ".yml", ".yaml", ".go", ".rs", ".php",
    ".c", ".cpp", ".h", ".cs", ".rb", ".sh",
}

IGNORED_PARTS = {
    "node_modules", ".git", ".next", "dist", "build",
    "vendor", "__pycache__", ".venv", "venv",
}

IGNORED_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "bun.lockb", "poetry.lock", "uv.lock",
}


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class AnalyzeRequest(BaseModel):
    repo_url: HttpUrl


class ChatRequest(BaseModel):
    repo_url: HttpUrl
    question: str


# --------------------------------------------------
# GENERAL HELPERS
# --------------------------------------------------

def parse_repository_url(repo_url):
    if repo_url.host != "github.com":
        raise HTTPException(
            status_code=400,
            detail="Only github.com repository URLs are supported.",
        )

    parts = repo_url.path.strip("/").split("/")

    if len(parts) != 2 or not all(parts):
        raise HTTPException(
            status_code=400,
            detail="Enter a URL in the format github.com/owner/repository.",
        )

    owner, repo = parts
    return owner, repo.removesuffix(".git")


def tokenize(text):
    words = re.findall(
        r"[a-zA-Z][a-zA-Z0-9_+#.-]*",
        text.lower(),
    )

    return {
        word for word in words
        if word not in STOP_WORDS and len(word) > 2
    }


def extract_sentences(text):
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


def summarize_readme(readme):
    sentences = extract_sentences(readme)

    if not sentences:
        return []

    documents = []

    for sentence in sentences:
        words = tokenize(sentence)
        documents.append(list(words))

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

        score /= math.sqrt(len(words))
        scores.append((score, index, sentences[index]))

    ranked = sorted(scores, reverse=True)[:5]
    ranked.sort(key=lambda item: item[1])

    return [item[2] for item in ranked]


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
        filename = file.split("/")[-1]

        if filename in indicators:
            technologies.add(indicators[filename])

    return sorted(technologies)


def path_is_relevant(path):
    parts = path.split("/")

    if any(part in IGNORED_PARTS for part in parts):
        return False

    filename = parts[-1]

    if filename in IGNORED_FILES:
        return False

    extension = (
        "." + filename.rsplit(".", 1)[-1].lower()
        if "." in filename else ""
    )

    return extension in SOURCE_EXTENSIONS


# --------------------------------------------------
# GITHUB API
# --------------------------------------------------

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
            detail="GitHub API rate limit reached. Try again later.",
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail="Unable to retrieve repository information from GitHub.",
        )

    return response.json()


# --------------------------------------------------
# OLLAMA EMBEDDINGS
# --------------------------------------------------

async def generate_embeddings(client, texts):
    response = await client.post(
        OLLAMA_EMBED,
        json={
            "model": EMBED_MODEL,
            "input": texts,
        },
        timeout=180.0,
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail="Ollama embedding generation failed. Check nomic-embed-text.",
        )

    embeddings = response.json().get("embeddings", [])

    if len(embeddings) != len(texts):
        raise HTTPException(
            status_code=502,
            detail="Ollama returned an unexpected number of embeddings.",
        )

    return embeddings


# --------------------------------------------------
# CODE CHUNKING
# --------------------------------------------------

def split_into_chunks(path, content):
    lines = content.splitlines()
    chunks = []

    start = 0

    while start < len(lines):
        end = min(start + CHUNK_LINES, len(lines))
        chunk_text = "\n".join(lines[start:end])

        if chunk_text.strip():
            chunks.append({
                "path": path,
                "start_line": start + 1,
                "end_line": end,
                "content": chunk_text,
            })

        if end == len(lines):
            break

        start = end - CHUNK_OVERLAP

    return chunks


# --------------------------------------------------
# CHROMADB COLLECTION
# --------------------------------------------------

def get_repository_collection(full_name):
    repo_hash = hashlib.sha1(
        full_name.lower().encode("utf-8")
    ).hexdigest()[:16]

    collection_name = f"repo_{repo_hash}"

    return chroma_client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )


# --------------------------------------------------
# REPOSITORY INGESTION AND INDEXING
# --------------------------------------------------

async def index_repository(client, owner, repo, repository):
    collection = get_repository_collection(repository["full_name"])

    if collection.count() > 0:
        return collection

    branch = repository["default_branch"]

    tree_data = await github_get(
        client,
        f"/repos/{owner}/{repo}/git/trees/"
        f"{quote(branch, safe='')}?recursive=1",
    )

    candidates = []

    for item in tree_data.get("tree", []):
        if item.get("type") != "blob":
            continue

        path = item.get("path", "")
        size = item.get("size", 0)

        if not path_is_relevant(path):
            continue

        if size <= 0 or size > MAX_FILE_SIZE:
            continue

        candidates.append(path)

    candidates = candidates[:MAX_FILES]

    if not candidates:
        raise HTTPException(
            status_code=404,
            detail="No suitable source files were found.",
        )

    raw_base = (
        f"https://raw.githubusercontent.com/"
        f"{owner}/{repo}/{quote(branch, safe='/')}"
    )

    chunks = []

    for path in candidates:
        try:
            response = await client.get(
                f"{raw_base}/{quote(path, safe='/')}"
            )

            if response.status_code != 200:
                continue

            content = response.text

            if not content.strip():
                continue

            chunks.extend(split_into_chunks(path, content))

        except httpx.HTTPError:
            continue

        if len(chunks) >= MAX_CHUNKS:
            chunks = chunks[:MAX_CHUNKS]
            break

    if not chunks:
        raise HTTPException(
            status_code=502,
            detail="Unable to download repository source files.",
        )

    # Generate embeddings in batches.
    for batch_start in range(0, len(chunks), 16):
        batch = chunks[batch_start:batch_start + 16]

        texts = [
            f"File: {item['path']}\n{item['content']}"
            for item in batch
        ]

        embeddings = await generate_embeddings(client, texts)

        ids = []
        documents = []
        metadatas = []

        for index, item in enumerate(batch):
            chunk_id = hashlib.sha1(
                (
                    item["path"]
                    + str(item["start_line"])
                    + item["content"]
                ).encode("utf-8")
            ).hexdigest()

            ids.append(chunk_id)
            documents.append(item["content"])

            metadatas.append({
                "path": item["path"],
                "start_line": item["start_line"],
                "end_line": item["end_line"],
            })

        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

    return collection


# --------------------------------------------------
# HYBRID RETRIEVAL
# --------------------------------------------------

async def retrieve_relevant_chunks(client, collection, question):
    question_embedding = await generate_embeddings(
        client,
        [question],
    )

    total_chunks = collection.count()

    if total_chunks == 0:
        raise HTTPException(
            status_code=404,
            detail="The repository has no indexed source chunks.",
        )

    results = collection.query(
        query_embeddings=question_embedding,
        n_results=min(20, total_chunks),
        include=["documents", "metadatas", "distances"],
    )

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    question_words = tokenize(question)
    ranked = []

    for document, metadata, distance in zip(
        documents, metadatas, distances
    ):
        path = metadata["path"]

        document_words = tokenize(document)
        path_words = tokenize(path.replace("/", " "))

        lexical_score = (
            len(question_words & document_words)
            + 2 * len(question_words & path_words)
        )

        vector_score = max(0.0, 1.0 - float(distance))

        combined_score = (
            0.65 * vector_score
            + 0.35 * min(lexical_score / 10, 1.0)
        )

        ranked.append({
            "path": path,
            "content": document,
            "start_line": metadata["start_line"],
            "end_line": metadata["end_line"],
            "score": combined_score,
        })

    ranked.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    return ranked[:6]


# --------------------------------------------------
# API ROUTES
# --------------------------------------------------

@app.get("/")
async def root():
    return {
        "message": "Welcome to RepoMind API",
        "status": "running",
        "version": "3.0.0",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/ai-status")
async def ai_status():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{OLLAMA_BASE}/api/tags"
            )

        if response.status_code != 200:
            return {
                "available": False,
                "model": OLLAMA_MODEL,
                "provider": "Ollama (local)",
            }

        models = response.json().get("models", [])
        names = [item.get("name", "") for item in models]

        chat_available = any(
            name.startswith(OLLAMA_MODEL) for name in names
        )

        embedding_available = any(
            name.startswith(EMBED_MODEL) for name in names
        )

        return {
            "available": chat_available and embedding_available,
            "model": OLLAMA_MODEL,
            "embedding_model": EMBED_MODEL,
            "provider": "Ollama (local)",
        }

    except httpx.HTTPError:
        return {
            "available": False,
            "model": OLLAMA_MODEL,
            "provider": "Ollama (local)",
        }


# --------------------------------------------------
# RAG CHAT ENDPOINT
# --------------------------------------------------

@app.post("/api/chat")
async def chat_with_repository(request: ChatRequest):
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Please enter a question.",
        )

    if len(question) > 1000:
        raise HTTPException(
            status_code=400,
            detail="Question must be 1000 characters or fewer.",
        )

    owner, repo = parse_repository_url(request.repo_url)

    github_headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RepoMind-Repository-Analyzer",
    }

    try:
        async with httpx.AsyncClient(
            timeout=60.0,
            headers=github_headers,
            follow_redirects=True,
        ) as client:

            repository = await github_get(
                client,
                f"/repos/{owner}/{repo}",
            )

            collection = await index_repository(
                client,
                owner,
                repo,
                repository,
            )

            source_chunks = await retrieve_relevant_chunks(
                client,
                collection,
                question,
            )

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Ollama. Make sure Ollama is running.",
        )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="The local embedding model took too long. Try again.",
        )

    context_parts = []

    for item in source_chunks:
        context_parts.append(
            f"FILE: {item['path']}\n"
            f"LINES: {item['start_line']}-{item['end_line']}\n"
            f"CODE:\n{item['content']}"
        )

    context = "\n\n---\n\n".join(context_parts)

    system_prompt = (
        "You are RepoMind, an expert software repository assistant. "
        "You answer questions about the supplied GitHub repository. "
        "Use the retrieved source code as your primary evidence. "
        "Never invent functions, files, dependencies, or behavior. "
        "If the evidence is insufficient, clearly say so. "
        "Explain the answer in clear, simple technical language. "
        "Mention exact file paths and line ranges when available. "
        "Distinguish confirmed facts from reasonable inferences."
    )

    user_prompt = (
        f"Repository: {repository['full_name']}\n\n"
        f"Question: {question}\n\n"
        f"Retrieved source code:\n{context}"
    )

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                OLLAMA_CHAT,
                json={
                    "model": OLLAMA_MODEL,
                    "stream": False,
                    "messages": [
                        {
                            "role": "system",
                            "content": system_prompt,
                        },
                        {
                            "role": "user",
                            "content": user_prompt,
                        },
                    ],
                    "options": {
                        "temperature": 0.2,
                    },
                },
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Ollama could not generate a response.",
            )

        result = response.json()

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running. Open the Ollama app.",
        )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="The local AI model took too long to respond.",
        )

    # Preserve the frontend's existing response contract.
    source_files = list(dict.fromkeys(
        item["path"] for item in source_chunks
    ))

    return {
        "success": True,
        "repository": repository["full_name"],
        "answer": result.get("message", {}).get("content", ""),
        "model": OLLAMA_MODEL,
        "provider": "Ollama (local Hybrid RAG)",
        "source_files": source_files,
    }


# --------------------------------------------------
# REPOSITORY ANALYSIS ENDPOINT
# --------------------------------------------------

@app.post("/api/analyze")
async def analyze_repository(request: AnalyzeRequest):
    owner, repo = parse_repository_url(request.repo_url)

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
            f"/repos/{owner}/{repo}/git/trees/"
            f"{quote(default_branch, safe='')}?recursive=1",
        )

        # Download a bounded set of source files for dependency analysis.
        source_file_contents = {}
        supported_extensions = (
            ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py"
        )
        ignored_directories = {
            "node_modules", ".git", ".next", "dist", "build",
            "vendor", "__pycache__", ".venv", "venv"
        }

        source_candidates = [
            item for item in tree_data.get("tree", [])
            if item.get("type") == "blob"
            and item.get("path", "").lower().endswith(supported_extensions)
            and item.get("size", MAX_FILE_SIZE + 1) <= MAX_FILE_SIZE
            and not any(
                part in ignored_directories
                for part in item.get("path", "").split("/")
            )
        ][:MAX_FILES]

        for item in source_candidates:
            source_path = item["path"]
            raw_url = (
                f"https://raw.githubusercontent.com/{owner}/{repo}/"
                f"{quote(default_branch, safe='')}/"
                f"{quote(source_path, safe='/')}"
            )

            try:
                raw_response = await client.get(raw_url)
                if raw_response.status_code == 200:
                    source_file_contents[source_path] = raw_response.text
            except httpx.HTTPError:
                continue

    tree = tree_data.get("tree", [])
    dependency_result = analyze_dependencies(source_file_contents)

    files = [
        item["path"]
        for item in tree
        if item.get("type") == "blob"
    ]

    directories = sorted(
        item["path"]
        for item in tree
        if item.get("type") == "tree"
    )

    # Preserve the recursive GitHub tree for the interactive explorer.
    tree_entries = [
        {
            "path": item["path"],
            "type": item["type"],
            "size": item.get("size"),
        }
        for item in tree
        if item.get("type") in {"blob", "tree"}
    ][:10000]

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
        "dependencies": dependency_result,
        "structure": {
            "total_files": len(files),
            "total_directories": len(directories),
            "directories": directories[:5000],
            "files": files[:10000],
            "tree": tree_entries,
            "truncated": (
                tree_data.get("truncated", False)
                or len(tree_entries) < len(tree)
            ),
        },
        "readme": {
            "available": bool(readme),
            "content": readme[:12000],
            "key_points": key_points,
        },
        "ai_analysis": {
            "method": (
                "TF-IDF-based extractive NLP and repository metadata analysis"
            ),
            "explanation": explanation,
            "summary_points": key_points,
        },
    }