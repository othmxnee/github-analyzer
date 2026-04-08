def _is_ignored_treemap_path(file_path):
    ignored_prefixes = ("test", "tests", "example", "examples", "doc", "docs")
    parts = [part.strip().lower() for part in str(file_path).split("/") if part.strip()]
    return any(any(part.startswith(prefix) for prefix in ignored_prefixes) for part in parts)


def _normalize_treemap_path(file_path):
    path = str(file_path or "").replace("\\", "/").strip()
    while "//" in path:
        path = path.replace("//", "/")
    path = path.lstrip("./").strip("/")

    # Keep a single package tree: src/flask/... and flask/... become flask/...
    if path.startswith("src/"):
        path = path[4:]

    return path


def build_treemap_data(df_files, top_n=300):
    if len(df_files) == 0:
        return {"ids": [], "labels": [], "parents": [], "values": [], "paths": []}

    files = df_files[["file_id", "commit_hash"]].dropna().drop_duplicates().copy()
    files["file_id"] = files["file_id"].apply(_normalize_treemap_path)
    files = files[files["file_id"] != ""]
    files = files[~files["file_id"].apply(_is_ignored_treemap_path)]

    if len(files) == 0:
        return {"ids": [], "labels": [], "parents": [], "values": [], "paths": []}

    file_mods = (
        files.groupby("file_id")["commit_hash"]
        .nunique()
        .sort_values(ascending=False)
    )

    if top_n is not None and top_n > 0:
        file_mods = file_mods.head(top_n)

    ids = ["root"]
    labels = ["Repository"]
    parents = [""]
    values = [0]
    paths = [""]

    added_nodes = {"root"}

    for file_path, modification_count in file_mods.items():
        normalized = str(file_path).strip("/")
        if not normalized:
            continue

        parts = [part for part in normalized.split("/") if part]
        if not parts:
            continue

        current_path = ""
        parent_id = "root"

        for folder in parts[:-1]:
            current_path = f"{current_path}/{folder}" if current_path else folder
            folder_id = f"dir:{current_path}"
            if folder_id not in added_nodes:
                ids.append(folder_id)
                labels.append(folder)
                parents.append(parent_id)
                values.append(0)
                paths.append(current_path)
                added_nodes.add(folder_id)
            parent_id = folder_id

        file_id = f"file:{normalized}"
        if file_id in added_nodes:
            continue

        ids.append(file_id)
        labels.append(parts[-1])
        parents.append(parent_id)
        values.append(int(modification_count))
        paths.append(normalized)
        added_nodes.add(file_id)

    return {
        "ids": ids,
        "labels": labels,
        "parents": parents,
        "values": values,
        "paths": paths,
    }
