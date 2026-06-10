"""Developer identity resolution (alias merging).

A single real contributor often commits under several emails — a work address,
a personal address, a GitHub "<id>@users.noreply.github.com" privacy address —
sometimes with the same display name, sometimes with slightly different names.
Keying metrics on the raw email therefore splits one person into several
"developers", which inflates the contributor count and the bus factor while
deflating the Gini coefficient. This module merges those aliases back together.

Approach (deliberately conservative, per the project's "only merge when the
name matches exactly" rule):

  * Build a graph whose nodes are emails and *non-generic* display names.
  * For every (name, email) pair seen in the history, connect the email node
    to the name node.
  * Each connected component is one identity. This merges:
      - the same email under several names (already one person),
      - several emails under one exact name,
      - and the transitive closure of the two.
  * Generic names ("root", "user", "unknown", a bare email, ...) never create a
    bridge, so two unrelated people who both committed as "root" stay separate.

The public entry point is :func:`build_identity_map`, which returns a mapping
from every lowercased email to its canonical email (the most frequently used
email in its component). Callers canonicalize their per-developer key through
this map before computing any metric.
"""

from collections import defaultdict, Counter

# Display names that are too generic to safely merge two different emails on.
# A commit whose name is one of these is treated as email-only (the name never
# bridges two emails).
_GENERIC_NAMES = {
    "", "root", "user", "admin", "administrator", "unknown", "none", "null",
    "your name", "ubuntu", "vagrant", "developer", "dev", "test", "tester",
    "guest", "localhost", "default", "me", "git", "github", "gituser",
}


def _norm_name(name) -> str:
    """Lowercase + collapse whitespace. Returns '' for empty / missing names."""
    if not name:
        return ""
    return " ".join(str(name).strip().lower().split())


def _norm_email(email) -> str:
    if not email:
        return ""
    return str(email).strip().lower()


def _is_generic_name(name: str) -> bool:
    if name in _GENERIC_NAMES:
        return True
    if len(name) < 2:
        return True
    # A "name" that is actually an email shouldn't bridge two emails.
    if "@" in name:
        return True
    return False


class _UnionFind:
    def __init__(self):
        self.parent = {}

    def find(self, x):
        self.parent.setdefault(x, x)
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        # Path compression
        while self.parent[x] != root:
            self.parent[x], x = root, self.parent[x]
        return root

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def build_identity_map(name_email_pairs):
    """Build a mapping ``email_lower -> canonical_email`` from observed commits.

    Parameters
    ----------
    name_email_pairs : iterable of (name, email)
        One entry per commit (duplicates welcome — they weight the canonical
        choice toward the email a person actually uses most).

    Returns
    -------
    dict
        Every distinct lowercased email maps to its component's canonical
        (most-used) lowercased email. Emails seen only once still appear,
        mapping to themselves.
    """
    uf = _UnionFind()
    email_counts = Counter()
    name_to_emails = defaultdict(set)

    for name, email in name_email_pairs:
        e = _norm_email(email)
        if not e:
            continue
        email_counts[e] += 1
        uf.find(e)  # ensure the email is a node

        n = _norm_name(name)
        if _is_generic_name(n):
            continue
        # Prefix name nodes so a name can never collide with an email node.
        name_node = "name::" + n
        name_to_emails[name_node].add(e)
        uf.union(name_node, e)

    # Group emails by component root.
    components = defaultdict(list)
    for email in email_counts:
        components[uf.find(email)].append(email)

    identity_map = {}
    for emails in components.values():
        # Canonical = most-used email; ties broken by alphabetical order so the
        # result is deterministic across runs.
        canonical = sorted(emails, key=lambda e: (-email_counts[e], e))[0]
        for e in emails:
            identity_map[e] = canonical

    return identity_map


def canonicalize_email(email, identity_map):
    """Map one email to its canonical form (identity-safe, never raises)."""
    e = _norm_email(email)
    return identity_map.get(e, e)


def merged_alias_count(identity_map):
    """How many emails were folded into a different canonical email.

    Equals (distinct emails) - (distinct identities); 0 means no merging
    happened. Useful as a transparency stat in the analysis summary.
    """
    if not identity_map:
        return 0
    distinct_emails = len(identity_map)
    distinct_identities = len(set(identity_map.values()))
    return distinct_emails - distinct_identities
