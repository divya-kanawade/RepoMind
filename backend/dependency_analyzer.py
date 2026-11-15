
import ast
import posixpath
import re
from pathlib import PurePosixPath
from typing import Any


JS_EXTENSIONS = (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs")
PYTHON_EXTENSIONS = (".py",)
MAX_DEPENDENCIES = 500


def normalize_path(path: str) -> str:
    normalized = posixpath.normpath(path)
    return normalized[2:] if normalized.startswith("./") else normalized


def build_file_index(file_contents: dict[str, str]) -> set[str]:
    return {normalize_path(path) for path in file_contents}


def resolve_javascript_import(
    source_file: str,
    specifier: str,
    file_index: set[str],
) -> str | None:
    if not specifier.startswith("."):
        return None

    base = posixpath.normpath(
        posixpath.join(posixpath.dirname(source_file), specifier)
    )

    candidates = [base]
    candidates.extend(base + ext for ext in JS_EXTENSIONS)
    candidates.extend(
        posixpath.join(base, "index" + ext)
        for ext in JS_EXTENSIONS
    )

    for candidate in candidates:
        candidate = normalize_path(candidate)
        if candidate in file_index:
            return candidate

    return None


def resolve_python_import(
    source_file: str,
    module: str,
    level: int,
    file_index: set[str],
) -> str | None:
    source_directory = posixpath.dirname(source_file)

    if level > 0:
        package_directory = source_directory
        for _ in range(max(0, level - 1)):
            package_directory = posixpath.dirname(package_directory)

        base = posixpath.normpath(
            posixpath.join(package_directory, module.replace(".", "/"))
        )
    else:
        base = module.replace(".", "/")

    candidates = [
        base + ".py",
        posixpath.join(base, "__init__.py"),
    ]

    if level == 0:
        candidates.extend([
            posixpath.join(source_directory, module.replace(".", "/") + ".py"),
            posixpath.join(
                source_directory,
                module.replace(".", "/"),
                "__init__.py",
            ),
        ])

    for candidate in candidates:
        candidate = normalize_path(candidate)
        if candidate in file_index:
            return candidate

    return None


def analyze_javascript_file(
    source_file: str,
    content: str,
    file_index: set[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    dependencies = []
    unresolved = []

    patterns = [
        r"""(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']""",
        r"""require\s*\(\s*["']([^"']+)["']\s*\)""",
        r"""import\s*\(\s*["']([^"']+)["']\s*\)""",
    ]

    seen = set()

    for pattern in patterns:
        for match in re.finditer(pattern, content):
            specifier = match.group(1)
            line = content.count("\n", 0, match.start()) + 1

            key = (specifier, line)
            if key in seen:
                continue
            seen.add(key)

            if not specifier.startswith("."):
                unresolved.append({
                    "source": source_file,
                    "specifier": specifier,
                    "line": line,
                    "kind": "external",
                })
                continue

            target = resolve_javascript_import(
                source_file, specifier, file_index
            )

            if target:
                dependencies.append({
                    "source": source_file,
                    "target": target,
                    "specifier": specifier,
                    "line": line,
                    "language": "javascript",
                    "verified": True,
                })
            else:
                unresolved.append({
                    "source": source_file,
                    "specifier": specifier,
                    "line": line,
                    "kind": "unresolved_local",
                })

    return dependencies, unresolved


def analyze_python_file(
    source_file: str,
    content: str,
    file_index: set[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    dependencies = []
    unresolved = []

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return dependencies, unresolved

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                module = alias.name
                target = resolve_python_import(
                    source_file, module, 0, file_index
                )

                if target:
                    dependencies.append({
                        "source": source_file,
                        "target": target,
                        "specifier": module,
                        "line": node.lineno,
                        "language": "python",
                        "verified": True,
                    })
                else:
                    unresolved.append({
                        "source": source_file,
                        "specifier": module,
                        "line": node.lineno,
                        "kind": "external_or_unresolved",
                    })

        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            target = resolve_python_import(
                source_file, module, node.level, file_index
            ) if module else None

            if target:
                dependencies.append({
                    "source": source_file,
                    "target": target,
                    "specifier": module,
                    "line": node.lineno,
                    "language": "python",
                    "verified": True,
                })
            elif module:
                unresolved.append({
                    "source": source_file,
                    "specifier": module,
                    "line": node.lineno,
                    "kind": "external_or_unresolved",
                })

    return dependencies, unresolved


def analyze_dependencies(
    file_contents: dict[str, str],
) -> dict[str, Any]:
    file_index = build_file_index(file_contents)
    dependencies = []
    unresolved = []
    files_analyzed = 0

    for original_path, content in file_contents.items():
        path = normalize_path(original_path)
        extension = PurePosixPath(path).suffix.lower()

        if extension in JS_EXTENSIONS:
            found, missing = analyze_javascript_file(
                path, content, file_index
            )
        elif extension in PYTHON_EXTENSIONS:
            found, missing = analyze_python_file(
                path, content, file_index
            )
        else:
            continue

        files_analyzed += 1
        dependencies.extend(found)
        unresolved.extend(missing)

    dependencies = dependencies[:MAX_DEPENDENCIES]
    unresolved = unresolved[:MAX_DEPENDENCIES]

    return {
        "dependencies": dependencies,
        "unresolved_imports": unresolved,
        "summary": {
            "files_analyzed": files_analyzed,
            "verified_dependencies": len(dependencies),
            "unresolved_imports": len(unresolved),
            "supported_languages": [
                "JavaScript",
                "TypeScript",
                "Python",
            ],
        },
    }
