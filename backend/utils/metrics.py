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


def compute_kci(df_files, repo_root):
    file_ids = df_files["file_id"].dropna().unique().tolist()
    
    line_counts = {}
    ownership_results = {}
    
    for file_id in file_ids:
        abs_path = repo_root / file_id
        
        if not abs_path.exists():
            continue
        
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
            line_counts[str(file_id)] = total_lines
            
            if total_lines == 0:
                continue
            
            ownership = {dev: lines / total_lines for dev, lines in dev_lines.items()}
            ownership_results[str(file_id)] = ownership
            
        except subprocess.CalledProcessError:
            continue
    
    kci = {}
    for file_id, owners in ownership_results.items():
        if len(owners) == 0:
            continue
        kci[file_id] = max(owners.values())
    
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


def generate_project_summary(metrics):
    gini = float(metrics.get("gini", 0.0))
    bus_factor = int(metrics.get("bus_factor", 0))
    kci_data = metrics.get("kci_data", {})
    risk_scores = metrics.get("risk_scores", {})
    hotspots = metrics.get("hotspots", [])
    architecture = metrics.get("architecture", {})

    score = 100
    insights = []
    recommendations = []

    if gini > 0.8:
        score -= 25
        insights.append(f"Contribution inequality is high (Gini = {gini:.2f}).")
        recommendations.append("Increase contributor diversity across active modules.")
    elif gini >= 0.6:
        score -= 12
        insights.append(f"Contribution inequality is moderate (Gini = {gini:.2f}).")
    else:
        insights.append(f"Contribution distribution is balanced (Gini = {gini:.2f}).")

    if bus_factor <= 2:
        score -= 25
        insights.append(f"Bus factor is low ({bus_factor}), indicating high continuity risk.")
        recommendations.append("Prioritize knowledge transfer for core maintainers.")
    elif bus_factor <= 5:
        score -= 12
        insights.append(f"Bus factor is moderate ({bus_factor}).")
    else:
        insights.append(f"Bus factor is healthy ({bus_factor}).")

    concentrated_files = [file_id for file_id, value in kci_data.items() if value > 0.8]
    if len(concentrated_files) >= 10:
        score -= 18
    elif len(concentrated_files) >= 4:
        score -= 10
    elif len(concentrated_files) > 0:
        score -= 4

    if concentrated_files:
        insights.append(
            f"Knowledge concentration detected in {len(concentrated_files)} files (KCI > 0.8)."
        )
        recommendations.append("Expand code ownership for highly concentrated files.")

    high_risk_files = [file_id for file_id, value in risk_scores.items() if value > 0.6]
    if len(high_risk_files) >= 5:
        score -= 14
    elif len(high_risk_files) > 0:
        score -= 8

    if high_risk_files:
        insights.append(
            f"{len(high_risk_files)} files show elevated combined architectural/ownership risk."
        )
        recommendations.append("Review and split responsibility on high-risk files.")

    top_arch_files = sorted(
        architecture.get("nodes", []),
        key=lambda node: node.get("pagerank", 0.0),
        reverse=True,
    )[:3]
    if top_arch_files:
        top_names = ", ".join(node.get("id", "") for node in top_arch_files)
        insights.append(f"Critical architectural files include {top_names}.")
        recommendations.append("Document critical architecture and add backup maintainers.")

    if hotspots:
        top_hotspots = ", ".join(file_id for file_id, _ in hotspots[:3])
        insights.append(f"Top modification hotspots include {top_hotspots}.")
        recommendations.append("Review hotspot files for refactoring opportunities.")

    score = max(0, min(100, int(round(score))))
    if score >= 80:
        risk_level = "Low"
    elif score >= 60:
        risk_level = "Moderate"
    else:
        risk_level = "High"

    # Preserve order while removing duplicates
    unique_recommendations = list(dict.fromkeys(recommendations))
    if not unique_recommendations:
        unique_recommendations = ["Continue monitoring ownership and architectural concentration over time."]

    return {
        "health_score": score,
        "risk_level": risk_level,
        "insights": insights,
        "recommendations": unique_recommendations,
    }
