import numpy as np
import pandas as pd
import networkx as nx
import subprocess
import ast
import re
from pathlib import Path
from collections import defaultdict


def compute_gini(values):
    array = np.array(values)
    if len(array) == 0:
        return 0.0
    array = np.sort(array)
    n = len(array)
    cumulative = np.cumsum(array)
    if cumulative[-1] == 0:
        return 0.0
    gini_value = (n + 1 - 2 * np.sum(cumulative) / cumulative[-1]) / n
    return float(gini_value)


def compute_lorenz(dev_activity):
    sorted_activity = dev_activity.sort_values()
    if len(sorted_activity) == 0:
        return {"x": [0, 1], "y": [0, 1]}
    
    cumulative_devs = np.arange(1, len(sorted_activity) + 1) / len(sorted_activity)
    cumulative_activity = sorted_activity.cumsum() / sorted_activity.sum()
    
    return {
        "x": [0.0] + list(cumulative_devs),
        "y": [0.0] + list(cumulative_activity)
    }


def compute_bus_factor(dev_activity):
    dev_activity = dev_activity.sort_values(ascending=False)
    total_activity = dev_activity.sum()
    if total_activity == 0:
        return 1
    
    cumulative = dev_activity.cumsum()
    bus_factor = (cumulative <= total_activity * 0.5).sum() + 1
    return int(bus_factor)


def normalize_path(path: str) -> str:
    """Normalize a repo-relative path so KCI, in-degree, and risk keys all match."""
    p = str(path).replace("\\", "/").strip().lstrip("./").strip("/")
    while "//" in p:
        p = p.replace("//", "/")
    if p.startswith("src/"):
        p = p[4:]
    return p


def compute_kci(df_files, repo_root):
    file_ids = df_files["file_id"].dropna().unique().tolist()

    line_counts = {}
    ownership_results = {}

    for file_id in file_ids:
        abs_path = repo_root / file_id
        if not abs_path.exists():
            stripped = str(file_id).lstrip("./")
            if stripped.startswith("src/"):
                stripped = stripped[4:]
            abs_path = repo_root / stripped
            if not abs_path.exists():
                continue
            file_id = stripped

        norm_key = normalize_path(file_id)

        try:
            output = subprocess.check_output(
                ["git", "-C", str(repo_root), "blame", "--line-porcelain", str(abs_path)],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            
            dev_lines = defaultdict(int)
            author = None
            
            for line in output.splitlines():
                if line.startswith("author "):
                    author = line.replace("author ", "").strip()
                elif line.startswith("\t"):
                    if author:
                        dev_lines[author] += 1
            
            total_lines = sum(dev_lines.values())
            line_counts[norm_key] = total_lines
            
            if total_lines == 0:
                continue
            
            ownership = {dev: lines / total_lines for dev, lines in dev_lines.items()}
            ownership_results[norm_key] = ownership
            
        except subprocess.CalledProcessError:
            continue
    
    kci = {}
    for norm_key, owners in ownership_results.items():
        if len(owners) == 0:
            continue
        kci[norm_key] = max(owners.values())
    
    return kci, line_counts, ownership_results

def compute_in_degree(repo_root):
    python_files = list(repo_root.rglob("*.py"))
    js_files = list(repo_root.rglob("*.js"))
    ts_files = list(repo_root.rglob("*.ts"))
    jsx_files = list(repo_root.rglob("*.jsx"))
    tsx_files = list(repo_root.rglob("*.tsx"))
    
    module_to_path = {}
    for p in python_files:
        try:
            rel = p.relative_to(repo_root)
            module = ".".join(rel.with_suffix("").parts)
            module_to_path[module] = str(rel)
        except ValueError:
            continue
    
    def resolve_import(file_path, module, level):
        rel = Path(file_path).with_suffix("")
        parts = list(rel.parts)
        if parts:
            parts = parts[:-1]
        if level and level > 0:
            parts = parts[: max(0, len(parts) - level + 1)]
        base = ".".join(parts)
        if module:
            return (base + "." + module).strip(".")
        return base
    
    dependency_graph = nx.DiGraph()
    
    for p in python_files + js_files + ts_files + jsx_files + tsx_files:
        try:
            rel_path = str(p.relative_to(repo_root))
            dependency_graph.add_node(rel_path)
        except ValueError:
            continue
    
    for p in python_files:
        try:
            file_id = str(p.relative_to(repo_root))
        except ValueError:
            continue
        
        try:
            with open(p, "r", encoding="utf8") as f:
                tree = ast.parse(f.read())
        except Exception:
            continue
        
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.extend([(alias.name, 0) for alias in node.names])
            elif isinstance(node, ast.ImportFrom):
                imports.append((node.module, node.level))
        
        for mod, level in imports:
            if level and level > 0:
                mod = resolve_import(file_id, mod, level)
            if not mod:
                continue
            if mod in module_to_path:
                dependency_graph.add_edge(file_id, module_to_path[mod])
                continue
            pkg_init = mod + ".__init__"
            if pkg_init in module_to_path:
                dependency_graph.add_edge(file_id, module_to_path[pkg_init])
    
    js_like_files = js_files + ts_files + jsx_files + tsx_files
    js_exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
    
    def resolve_js_import(from_path, spec):
        if not spec or not spec.startswith("."):
            return None
        base = (repo_root / from_path).parent
        candidate = (base / spec).resolve()
        
        if candidate.is_file():
            try:
                return str(candidate.relative_to(repo_root))
            except ValueError:
                return None
        
        for ext in js_exts:
            if candidate.with_suffix(ext).is_file():
                try:
                    return str(candidate.with_suffix(ext).relative_to(repo_root))
                except ValueError:
                    return None
        
        for ext in js_exts:
            index_file = candidate / f"index{ext}"
            if index_file.is_file():
                try:
                    return str(index_file.relative_to(repo_root))
                except ValueError:
                    return None
        
        return None
    
    import_re = re.compile(r'(?:import\s+[^;]*?from\s+|import\s*\(|require\s*\()\s*["\']([^"\']+)["\']')
    
    for p in js_like_files:
        try:
            file_id = str(p.relative_to(repo_root))
        except ValueError:
            continue
        
        try:
            content = p.read_text(encoding="utf8", errors="ignore")
        except Exception:
            continue
        
        for match in import_re.findall(content):
            target = resolve_js_import(file_id, match)
            if target:
                dependency_graph.add_edge(file_id, target)
    
    if dependency_graph.number_of_nodes() == 0:
        return {}
    
    in_degree = dict(dependency_graph.in_degree())
    
    return in_degree


def compute_risk_score(kci_data, in_degree_data):
    if not kci_data or not in_degree_data:
        return {}
    
    common_files = set(kci_data.keys()) & set(in_degree_data.keys())
    
    if not common_files:
        return {}
    
    indeg_values = []
    for file in common_files:
        if file in in_degree_data:
            indeg_values.append(in_degree_data[file])
    
    if not indeg_values:
        return {}
    
    indeg_min = min(indeg_values)
    indeg_max = max(indeg_values)
    
    risk_scores = {}
    for file in common_files:
        if indeg_max > indeg_min:
            indeg_norm = (in_degree_data[file] - indeg_min) / (indeg_max - indeg_min)
        else:
            indeg_norm = 0
        
        risk_scores[file] = indeg_norm * kci_data[file]
    
    sorted_risk = sorted(risk_scores.items(), key=lambda x: x[1], reverse=True)
    
    return dict(sorted_risk[:10])


def build_dependency_graph(repo_root, max_nodes=200, max_lines=1500):
    ignored_prefixes = ("test", "tests", "example", "examples", "doc", "docs")
    repo_root = Path(repo_root)

    python_files = []
    for p in repo_root.rglob("*.py"):
        try:
            rel = p.relative_to(repo_root)
        except ValueError:
            continue

        if any(part.lower().startswith(prefix) for part in rel.parts for prefix in ignored_prefixes):
            continue

        try:
            with p.open("r", encoding="utf8", errors="ignore") as f:
                line_count = sum(1 for _ in f)
        except OSError:
            continue

        if line_count > max_lines:
            continue

        python_files.append(p)

    module_to_path = {}
    for p in python_files:
        rel = p.relative_to(repo_root)
        full_module = ".".join(rel.with_suffix("").parts)
        module_to_path[full_module] = str(rel)

        if rel.parts and rel.parts[0] in {"src", "lib"}:
            stripped_module = ".".join(rel.with_suffix("").parts[1:])
            if stripped_module:
                module_to_path[stripped_module] = str(rel)

    def resolve_relative_import(file_id, module, level):
        rel = Path(file_id).with_suffix("")
        parts = list(rel.parts[:-1])
        if level and level > 0:
            parts = parts[: max(0, len(parts) - level + 1)]
        base = ".".join(parts)
        if module:
            return (base + "." + module).strip(".")
        return base

    def module_to_file(module_name):
        if not module_name:
            return None
        if module_name in module_to_path:
            return module_to_path[module_name]
        pkg_init = module_name + ".__init__"
        if pkg_init in module_to_path:
            return module_to_path[pkg_init]
        return None

    graph = nx.DiGraph()
    for p in python_files:
        graph.add_node(str(p.relative_to(repo_root)))

    for p in python_files:
        file_id = str(p.relative_to(repo_root))
        try:
            with p.open("r", encoding="utf8", errors="ignore") as f:
                tree = ast.parse(f.read())
        except Exception:
            continue

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    target = module_to_file(alias.name)
                    if target:
                        graph.add_edge(file_id, target)
            elif isinstance(node, ast.ImportFrom):
                module_name = node.module
                if node.level and node.level > 0:
                    module_name = resolve_relative_import(file_id, module_name, node.level)
                target = module_to_file(module_name)
                if target:
                    graph.add_edge(file_id, target)

    # ── JS / TS ───────────────────────────────────────────────────────────
    js_exts = [".ts", ".tsx", ".js", ".jsx", ".mjs"]
    js_like_files = []
    for ext in js_exts:
        for p in repo_root.rglob(f"*{ext}"):
            try:
                rel = p.relative_to(repo_root)
            except ValueError:
                continue
            if any(part.lower().startswith(pfx) for part in rel.parts for pfx in ignored_prefixes):
                continue
            js_like_files.append(p)

    _js_res_exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
    js_import_re = re.compile(r'(?:import\s+[^;]*?from\s+|import\s*\(|require\s*\()\s*["\']([^"\']+)["\']')

    def _resolve_js(from_path, spec):
        if not spec or not spec.startswith("."):
            return None
        base = (repo_root / from_path).parent
        candidate = (base / spec).resolve()
        if candidate.is_file():
            try:
                return str(candidate.relative_to(repo_root))
            except ValueError:
                return None
        for ext in _js_res_exts:
            for target in [candidate.with_suffix(ext), candidate / f"index{ext}"]:
                if target.is_file():
                    try:
                        return str(target.relative_to(repo_root))
                    except ValueError:
                        return None
        return None

    for p in js_like_files:
        try:
            file_id = str(p.relative_to(repo_root))
            graph.add_node(file_id)
            content = p.read_text(encoding="utf8", errors="ignore")
            for match in js_import_re.findall(content):
                target = _resolve_js(file_id, match)
                if target:
                    graph.add_edge(file_id, target)
        except Exception:
            continue

    # ── Java ─────────────────────────────────────────────────────────────
    java_files = []
    for p in repo_root.rglob("*.java"):
        try:
            rel = p.relative_to(repo_root)
        except ValueError:
            continue
        if any(part.lower().startswith(pfx) for part in rel.parts for pfx in ignored_prefixes):
            continue
        java_files.append(p)

    if java_files:
        java_index: dict[str, str] = {}
        for p in java_files:
            try:
                file_id = str(p.relative_to(repo_root))
                graph.add_node(file_id)
                key = ".".join(p.relative_to(repo_root).with_suffix("").parts)
                java_index[key] = file_id
                java_index.setdefault(p.stem, file_id)
            except ValueError:
                pass
        java_imp_re = re.compile(r'^import\s+(?:static\s+)?([\w.]+?)(?:\.\*)?;', re.MULTILINE)
        for p in java_files:
            try:
                file_id = str(p.relative_to(repo_root))
                content = p.read_text(encoding="utf8", errors="ignore")
                for m in java_imp_re.finditer(content):
                    target = java_index.get(m.group(1))
                    if target and target != file_id:
                        graph.add_edge(file_id, target)
            except Exception:
                pass

    # ── Go ────────────────────────────────────────────────────────────────
    go_files = []
    for p in repo_root.rglob("*.go"):
        try:
            rel = p.relative_to(repo_root)
        except ValueError:
            continue
        if any(part.lower().startswith(pfx) for part in rel.parts for pfx in ignored_prefixes):
            continue
        go_files.append(p)

    if go_files:
        go_dir_files: dict[str, list[str]] = {}
        for p in go_files:
            try:
                file_id = str(p.relative_to(repo_root))
                graph.add_node(file_id)
                dir_key = str(p.parent.relative_to(repo_root))
                go_dir_files.setdefault(dir_key, []).append(file_id)
            except ValueError:
                pass
        go_rel_re = re.compile(r'"(\./[^"]+|\.\.\/[^"]+)"')
        for p in go_files:
            try:
                file_id = str(p.relative_to(repo_root))
                content = p.read_text(encoding="utf8", errors="ignore")
                for m in go_rel_re.finditer(content):
                    target_dir = (p.parent / m.group(1)).resolve()
                    try:
                        dir_rel = str(target_dir.relative_to(repo_root))
                        for tf in go_dir_files.get(dir_rel, [])[:1]:
                            graph.add_edge(file_id, tf)
                    except ValueError:
                        pass
            except Exception:
                pass

    # ── Rust ─────────────────────────────────────────────────────────────
    rust_files = []
    for p in repo_root.rglob("*.rs"):
        try:
            rel = p.relative_to(repo_root)
        except ValueError:
            continue
        if any(part.lower().startswith(pfx) for part in rel.parts for pfx in ignored_prefixes):
            continue
        rust_files.append(p)

    if rust_files:
        rust_mod_re = re.compile(r'^(?:pub\s+)?mod\s+(\w+)\s*;', re.MULTILINE)
        for p in rust_files:
            try:
                file_id = str(p.relative_to(repo_root))
                graph.add_node(file_id)
                content = p.read_text(encoding="utf8", errors="ignore")
                for m in rust_mod_re.finditer(content):
                    mod_name = m.group(1)
                    for candidate in [p.parent / f"{mod_name}.rs", p.parent / mod_name / "mod.rs"]:
                        if candidate.exists():
                            try:
                                graph.add_edge(file_id, str(candidate.relative_to(repo_root)))
                            except ValueError:
                                pass
                            break
            except Exception:
                pass

    # ── C / C++ ──────────────────────────────────────────────────────────
    c_files = []
    for ext in ["*.c", "*.cpp", "*.cc", "*.cxx", "*.h", "*.hpp"]:
        for p in repo_root.rglob(ext):
            try:
                rel = p.relative_to(repo_root)
            except ValueError:
                continue
            if any(part.lower().startswith(pfx) for part in rel.parts for pfx in ignored_prefixes):
                continue
            c_files.append(p)

    if c_files:
        c_inc_re = re.compile(r'^#include\s+"([^"]+)"', re.MULTILINE)
        for p in c_files:
            try:
                file_id = str(p.relative_to(repo_root))
                graph.add_node(file_id)
                content = p.read_text(encoding="utf8", errors="ignore")
                for m in c_inc_re.finditer(content):
                    candidate = (p.parent / m.group(1)).resolve()
                    if candidate.exists():
                        try:
                            graph.add_edge(file_id, str(candidate.relative_to(repo_root)))
                        except ValueError:
                            pass
            except Exception:
                pass

    if graph.number_of_nodes() == 0:
        return {"nodes": [], "edges": []}

    in_degree_all = dict(graph.in_degree())
    out_degree_all = dict(graph.out_degree())
    total_degree_all = {
        node: int(in_degree_all.get(node, 0) + out_degree_all.get(node, 0))
        for node in graph.nodes()
    }

    connected_nodes = [node for node, degree in total_degree_all.items() if degree > 0]
    if not connected_nodes:
        connected_nodes = list(graph.nodes())

    ranked_nodes = sorted(
        connected_nodes,
        key=lambda node: (total_degree_all.get(node, 0), in_degree_all.get(node, 0)),
        reverse=True,
    )

    selected_nodes = set(ranked_nodes[:max_nodes])
    subgraph = graph.subgraph(selected_nodes).copy()

    if subgraph.number_of_edges() > 0:
        largest = max(nx.weakly_connected_components(subgraph), key=len)
        subgraph = subgraph.subgraph(largest).copy()

    if subgraph.number_of_nodes() == 0:
        return {"nodes": [], "edges": []}

    in_degree = dict(subgraph.in_degree())
    out_degree = dict(subgraph.out_degree())
    total_degree = {
        node: int(in_degree.get(node, 0) + out_degree.get(node, 0))
        for node in subgraph.nodes()
    }

    if subgraph.number_of_edges() > 0:
        pagerank = nx.pagerank(subgraph)
    else:
        uniform = 1.0 / subgraph.number_of_nodes()
        pagerank = {node: uniform for node in subgraph.nodes()}

    ordered_nodes = sorted(
        subgraph.nodes(),
        key=lambda node: (total_degree.get(node, 0), in_degree.get(node, 0)),
        reverse=True,
    )

    nodes = [
        {
            "id": node,
            "degree": int(in_degree.get(node, 0)),
            "pagerank": float(pagerank.get(node, 0.0)),
        }
        for node in ordered_nodes
    ]

    edges = [
        {"source": src, "target": dst}
        for src, dst in subgraph.edges()
    ]

    return {"nodes": nodes, "edges": edges}



def simulate_bus_factor_risk(ownership_results, line_counts):
    dev_lines = defaultdict(float)
    total_lines = 0.0

    for file_id, owners in ownership_results.items():
        file_lines = float(line_counts.get(file_id, 0))
        if file_lines <= 0:
            continue

        total_lines += file_lines
        for dev, share in owners.items():
            dev_lines[dev] += float(share) * file_lines

    if total_lines <= 0:
        return {"developers": [], "simulation": []}

    sorted_devs = sorted(dev_lines.items(), key=lambda x: x[1], reverse=True)
    developers = [
        {"name": dev, "ownership": float(lines / total_lines)}
        for dev, lines in sorted_devs
    ]

    simulation = []
    cumulative = 0.0
    for i, (_, lines) in enumerate(sorted_devs, start=1):
        cumulative += lines / total_lines
        simulation.append(
            {
                "removed": i,
                "knowledge_lost": float(min(cumulative, 1.0)),
            }
        )

    return {"developers": developers, "simulation": simulation}

def _bus_score(bus_factor):
    if bus_factor >= 7: return 100
    if bus_factor >= 5: return 80
    if bus_factor >= 3: return 55
    if bus_factor == 2: return 25
    return 0  # 1 or less


def _gini_score(gini):
    if gini <= 0.30: return 100
    if gini <= 0.50: return 75
    if gini <= 0.65: return 50
    if gini <= 0.80: return 25
    return 0  # above 0.80


def _kci_indegree_score(risk_scores):
    # risk_scores already contains kci × normalized_indegree per file
    if not risk_scores:
        return 100
    avg = sum(risk_scores.values()) / len(risk_scores)
    if avg <= 0.10: return 100
    if avg <= 0.25: return 75
    if avg <= 0.45: return 50
    if avg <= 0.65: return 25
    return 0


def generate_project_summary(metrics):
    gini        = float(metrics.get("gini", 0.0))
    bus_factor  = int(metrics.get("bus_factor", 0))
    risk_scores = metrics.get("risk_scores", {})  # this is kci × in_degree from compute_risk_score()

    bus_s  = _bus_score(bus_factor)
    gini_s = _gini_score(gini)
    kci_s  = _kci_indegree_score(risk_scores)

    health_score = round(bus_s * 0.40 + gini_s * 0.35 + kci_s * 0.25)

    if health_score >= 80:   risk_level = "Low"
    elif health_score >= 60: risk_level = "Moderate"
    elif health_score >= 40: risk_level = "High"
    else:                    risk_level = "Critical"

    # --- Insights ---
    insights = []

    if bus_factor <= 1:
        insights.append(f"Bus factor is critically low ({bus_factor}) — one person leaving could stall the project.")
    elif bus_factor <= 2:
        insights.append(f"Bus factor is low ({bus_factor}), posing a real continuity risk.")
    elif bus_factor <= 4:
        insights.append(f"Bus factor is moderate ({bus_factor}).")
    else:
        insights.append(f"Bus factor is healthy ({bus_factor}).")

    if gini > 0.80:
        insights.append(f"Contribution inequality is very high (Gini = {gini:.2f}) — a few developers do almost everything.")
    elif gini > 0.65:
        insights.append(f"Contribution inequality is high (Gini = {gini:.2f}).")
    elif gini > 0.50:
        insights.append(f"Contribution inequality is moderate (Gini = {gini:.2f}).")
    else:
        insights.append(f"Contributions are well distributed (Gini = {gini:.2f}).")

    if risk_scores:
        avg_kci = sum(risk_scores.values()) / len(risk_scores)
        top_files = list(risk_scores.keys())[:3]
        if avg_kci > 0.45:
            insights.append(f"High knowledge concentration on critical files (avg KCI×InDegree = {avg_kci:.2f}). Top files: {', '.join(top_files)}.")
        elif avg_kci > 0.10:
            insights.append(f"Moderate knowledge concentration on critical files (avg = {avg_kci:.2f}). Top files: {', '.join(top_files)}.")
        else:
            insights.append("Knowledge is well spread across architecturally important files.")

    # --- Recommendations ---
    recommendations = []
    if bus_factor <= 2:
        recommendations.append("Cross-train developers on core modules to raise the bus factor.")
    if gini > 0.65:
        recommendations.append("Encourage more developers to contribute to active modules to reduce inequality.")
    if kci_s <= 50 and risk_scores:
        top_files = list(risk_scores.keys())[:3]
        recommendations.append(f"Spread knowledge on high-risk files: {', '.join(top_files)}.")
    if not recommendations:
        recommendations.append("Repository looks healthy. Keep monitoring metrics as the project evolves.")

    return {
        "health_score": health_score,
        "risk_level":   risk_level,
        "insights":     insights,
        "recommendations": recommendations,
        "dimensions": {
            "Bus Factor":       bus_s,
            "Gini Coefficient": gini_s,
            "KCI × In-Degree":  kci_s,
        }
    }