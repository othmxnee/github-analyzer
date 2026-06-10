import os
import re
from collections import defaultdict

# ---------- File extension classification ----------
FRONTEND_EXTENSIONS  = {'.css', '.html', '.scss', '.sass', '.less', '.styl',
                        '.vue', '.svelte', '.elm', '.erb', '.ejs', '.pug',
                        '.hbs', '.astro'}
BACKEND_PY_EXT       = {'.py'}
BACKEND_JAVA_EXT     = {'.java', '.kt', '.scala'}
# Compiled / systems / server backend languages. These have no frontend
# variant, so a file in one of them is backend work regardless of folder.
# (.h/.hpp can also be iOS Objective-C headers; the iOS-locality rule below
# reclassifies those before this set is consulted.)
BACKEND_SYS_EXT      = {'.go', '.rs', '.c', '.cpp', '.cc', '.cxx',
                        '.h', '.hpp', '.cs', '.rb', '.php',
                        '.lua', '.fs', '.ex', '.exs', '.clj', '.cljs',
                        '.r', '.sql', '.graphql', '.gql', '.proto',
                        '.ipynb'}
DEVOPS_EXTENSIONS    = {'.yml', '.yaml', '.sh', '.dockerfile', '.toml', '.cfg', '.ini'}
BUILD_FILES          = {'pom.xml', 'build.gradle', 'build.gradle.kts',
                        'requirements.txt', 'setup.py', 'setup.cfg',
                        'pyproject.toml', 'package.json', 'build.xml',
                        'gemfile', 'gemfile.lock', 'go.mod', 'go.sum',
                        'cargo.toml', 'cargo.lock', 'pubspec.yaml', 'pubspec.lock'}
DOC_EXTENSIONS       = {'.md', '.rst', '.txt', '.adoc'}
# Objective-C / Objective-C++ sources, used almost only in iOS/macOS apps.
IOS_OBJC_EXT         = {'.m', '.mm'}

DEVOPS_FILENAMES     = {'dockerfile', 'jenkinsfile', 'makefile', '.travis.yml',
                        'docker-compose.yml', 'docker-compose.yaml'}

TEST_FOLDER_KEYWORDS = {'test', 'tests', 'spec', 'specs', '__tests__'}

# Note: 'src' and 'lib' are deliberately excluded. They are the default root
# for frontend projects too (a React app lives under src/), so treating them
# as backend signals mislabels frontend JS/TS as backend. Only folders that
# genuinely denote server-side work are listed.
BACKEND_FOLDERS  = {'server', 'backend', 'api', 'services', 'routes',
                    'controllers', 'models', 'db', 'database', 'middleware',
                    'worker', 'queue'}
# Default-mobile extensions. .dart (Flutter), .swift and Objective-C
# (.m/.mm) are overwhelmingly Apple-platform or mobile. The iOS-locality rule
# above promotes .swift/.m/.mm/.h under a mobile module first; these defaults
# catch the common case where the file is mobile but no module marker was in
# the mined paths. Server-side Swift under a backend/ folder is still caught
# by that folder signal before reaching here.
MOBILE_EXTENSIONS = {'.dart', '.swift', '.m', '.mm'}
MOBILE_FILES      = {'androidmanifest.xml', 'info.plist', 'pubspec.yaml'}
MOBILE_FOLDERS    = {'android', 'ios', 'mobile', 'flutter', 'react-native'}
FRONTEND_FOLDERS = {'client', 'frontend', 'ui', 'components', 'pages',
                    'views', 'hooks', 'stores', 'public', 'assets',
                    'styles', 'app'}

# ---------- Commit message keywords ----------
KEYWORDS = {
    'frontend': ['ui', 'style', 'component', 'layout', 'css', 'html', 'design',
                 'template', 'view', 'render', 'frontend', 'front-end'],
    'backend':  ['api', 'endpoint', 'model', 'database', 'query', 'server',
                 'backend', 'back-end', 'route', 'controller', 'service', 'orm'],
    'mobile':   ['android', 'ios', 'flutter', 'swift', 'kotlin',
                 'mobile', 'react-native', 'cordova', 'ionic'],
    'test':     ['test', 'spec', 'assert', 'mock', 'coverage', 'fix', 'bug',
                 'bugfix', 'unittest', 'pytest'],
    'devops':   ['deploy', 'docker', 'pipeline', 'ci', 'cd', 'build', 'release',
                 'workflow', 'action', 'infra', 'kubernetes', 'helm'],
    'docs':     ['doc', 'docs', 'readme', 'documentation', 'comment', 'changelog']
}

# Precompiled whole-word matchers per role. Substring matching wrongly fired
# short keywords inside unrelated words — e.g. the DevOps keyword "ci" matched
# "de(ci)sion", "spe(ci)fic", "poli(ci)es". Matching only at token boundaries
# (anything that isn't a letter/digit, so hyphens in "front-end" still count)
# fixes that. Keywords are sorted longest-first so the alternation is greedy.
_KEYWORD_RE = {
    role: re.compile(
        r'(?<![a-z0-9])(?:'
        + '|'.join(re.escape(kw) for kw in sorted(kws, key=len, reverse=True))
        + r')(?![a-z0-9])',
        re.IGNORECASE,
    )
    for role, kws in KEYWORDS.items()
}

# ---------- Role thresholds ----------
THRESHOLDS = {
    'tester':    0.60,   # test files must be a clear majority (QA-focused), not just present
    'devops':    0.20,
    'fullstack': 0.25,
    'frontend':  0.40,
    'backend':   0.35,
    'mobile':    0.25,
}

CATEGORIES = ['frontend', 'backend_py', 'backend_java', 'backend_sys',
              'backend_js', 'mobile', 'test', 'devops', 'build', 'docs', 'other']

MIN_COMMITS = 2  # minimum commits to assign a role


# Filenames that mark a directory subtree as a native mobile module.
_ANDROID_MARKERS = {'androidmanifest.xml'}
_IOS_MARKERS     = {'info.plist', 'podfile', 'podfile.lock'}
_IOS_MARKER_EXTS = {'.xcodeproj', '.xcworkspace', '.pbxproj'}


def detect_mobile_roots(paths):
    """Derive the Android and iOS module root directories from a list of paths.

    A subtree is a mobile module when it contains a marker file: an
    AndroidManifest.xml for Android, or an Info.plist / Podfile / Xcode project
    for iOS. The root is the directory above the source tree (the part before
    /src/), or the marker's own directory otherwise. Roots are lowercase and
    forward-slashed. They let a .kt/.java/.swift/.m file be classified as
    mobile when it sits under a mobile module and as backend otherwise, so a
    repo with both /backend and /android (or /ios) is split per locality.
    """
    roots = set()
    for p in paths or []:
        if not p:
            continue
        norm = p.replace('\\', '/').lower()
        base = os.path.basename(norm)
        ext = os.path.splitext(base)[1]
        is_marker = (base in _ANDROID_MARKERS or base in _IOS_MARKERS or
                     ext in _IOS_MARKER_EXTS or
                     any(seg.endswith(tuple(_IOS_MARKER_EXTS)) for seg in norm.split('/')))
        if is_marker:
            module = norm.split('/src/', 1)[0]
            if '/src/' not in norm:
                module = os.path.dirname(norm)
            if module:
                roots.add(module)
    return roots


# Backwards-compatible alias.
def detect_android_roots(paths):
    return detect_mobile_roots(paths)


def _under_mobile_root(path_lower, mobile_roots):
    if not mobile_roots:
        return False
    return any(path_lower == r or path_lower.startswith(r + '/')
               for r in mobile_roots)


def get_file_category(filepath, mobile_roots=None):
    """Classify a file path into a category.

    mobile_roots: set of native mobile module root dirs (see
    detect_mobile_roots). A .kt/.java/.swift/.m/.mm/.h file under one of them
    is mobile work; the same extension elsewhere is treated as backend, since
    these extensions are also used for server-side code.
    """
    if filepath is None:
        return 'other'

    path_lower = filepath.lower()
    filename   = os.path.basename(path_lower)
    ext        = os.path.splitext(filename)[1]
    parts      = path_lower.replace('\\', '/').split('/')
    parts_set  = set(parts)

    # Test. "spec" must be a whole token (foo.spec.ts, user_spec.rb), not a
    # substring, so files like pubspec.yaml or specification.md are not tests.
    name_no_ext = filename[:-len(ext)] if ext else filename
    if parts_set & TEST_FOLDER_KEYWORDS:
        return 'test'
    if (filename.startswith('test_') or name_no_ext.endswith('_test') or
            name_no_ext.endswith('.test') or name_no_ext.endswith('.spec') or
            name_no_ext.endswith('_spec') or name_no_ext == 'spec' or
            filename.endswith('test.java')):
        return 'test'

    # DevOps by explicit filename (Dockerfile, docker-compose.yml, ...).
    if filename in DEVOPS_FILENAMES:
        return 'devops'

    # Build manifests by exact filename. Checked before the DevOps extension
    # rule so build files that happen to be .toml/.yaml (Cargo.toml,
    # pubspec.yaml) are build, not devops.
    if filename in BUILD_FILES:
        return 'build'

    # DevOps by generic config extension (.yml, .yaml, .toml, .sh, ...).
    if ext in DEVOPS_EXTENSIONS:
        return 'devops'

    # Native mobile: Kotlin/Java/Swift/Objective-C under a mobile module is
    # mobile work, not backend. Checked before the backend rules because these
    # extensions are otherwise claimed by backend_java / backend_sys.
    if (ext in {'.kt', '.java', '.swift', '.m', '.mm', '.h'} and
            _under_mobile_root(path_lower, mobile_roots)):
        return 'mobile'

    # Python / Java always backend
    if ext in BACKEND_PY_EXT:
        return 'backend_py'
    if ext in BACKEND_JAVA_EXT:
        return 'backend_java'
    if ext in BACKEND_SYS_EXT:
        return 'backend_sys'

    # Mobile
    if ext in MOBILE_EXTENSIONS:
        return 'mobile'
    if filename in MOBILE_FILES:
        return 'mobile'
    if parts_set & MOBILE_FOLDERS:
        return 'mobile'

    # JS/TS: use folder to decide
    if ext in {'.js', '.ts', '.jsx', '.tsx'}:
        if parts_set & BACKEND_FOLDERS:
            return 'backend_js'
        if parts_set & FRONTEND_FOLDERS:
            return 'frontend'
        if any(x in filename for x in ['controller', 'router', 'service',
                                        'model', 'middleware', 'handler']):
            return 'backend_js'
        return 'frontend'

    # CSS/HTML always frontend
    if ext in FRONTEND_EXTENSIONS:
        return 'frontend'

    # Docs
    if ext in DOC_EXTENSIONS:
        return 'docs'

    return 'other'


def get_keyword_scores(message):
    """Return keyword match dict for a commit message (whole-word matching)."""
    if not message:
        return {role: 0 for role in KEYWORDS}
    return {role: 1 if _KEYWORD_RE[role].search(message) else 0
            for role in KEYWORDS}


def assign_role(frontend, backend, test, devops, mobile):
    # Tester only when testing is the developer's primary work: test files must
    # be a clear majority of their changes AND outweigh production code (backend
    # plus frontend together). A backend or frontend developer who also writes
    # tests therefore keeps their production role; only a QA-focused contributor,
    # whose output is mostly test files, is labelled Tester. This avoids the
    # earlier inflation where a >40% test share alone forced the Tester label.
    if test >= THRESHOLDS['tester'] and test > (backend + frontend):
        return 'Tester'
    if devops >= THRESHOLDS['devops'] and devops > backend and devops > frontend:
        return 'DevOps'
    if mobile >= THRESHOLDS['mobile']:
        return 'Mobile'
    # Full Stack: both stacks meaningfully present (>= 10%) and neither dominates by more than 2x
    if (frontend >= 0.10 and backend >= 0.10 and
            min(frontend, backend) / max(frontend, backend) >= 0.5):
        return 'Full Stack'
    if frontend >= THRESHOLDS['frontend']:
        return 'Frontend'
    if backend  >= THRESHOLDS['backend']:
        return 'Backend'
    return 'Generalist'


def _specialization_index(signals):
    """How concentrated a developer's work is across activity types.

    1.0 = pure specialist (all work in one area); 0.0 = perfectly even
    generalist. Computed as 1 - normalized Shannon entropy over the non-zero
    signal shares. A simple, interpretable companion to the role label: a team
    of only high-specialization members is more fragile than a balanced one.
    """
    import math
    vals = [v for v in signals.values() if v > 0]
    total = sum(vals)
    if total <= 0 or len(vals) <= 1:
        return 1.0 if len(vals) == 1 else 0.0
    probs = [v / total for v in vals]
    entropy = -sum(p * math.log(p) for p in probs)
    max_entropy = math.log(len(vals))
    if max_entropy <= 0:
        return 1.0
    return round(1.0 - entropy / max_entropy, 3)


def _role_confidence(role_signals):
    """Confidence in the assigned role: gap between the top two role signals.

    (top - second) / top, in [0, 1]. A clear dominant area → high confidence;
    two near-equal areas (e.g. a genuine Full Stack split) → low confidence,
    which honestly flags the assignment as borderline rather than certain.
    """
    vals = sorted((v for v in role_signals if v is not None), reverse=True)
    if not vals or vals[0] <= 0:
        return 0.0
    top = vals[0]
    second = vals[1] if len(vals) > 1 else 0.0
    return round((top - second) / top, 3)


def compute_skill_metrics(commits_data):
    """
    Given commits_data (list of dicts with author_email, message, modified_files),
    compute per-developer skill metrics and assign roles.

    Each item in commits_data:
    {
        'author_email': str,
        'message': str,
        'modified_files': [{'path': str, 'added': int, 'deleted': int}]
    }

    Returns a list of dicts (one per developer).
    """
    lines_by_category = defaultdict(lambda: defaultdict(int))
    keyword_hits      = defaultdict(lambda: defaultdict(int))
    total_commits     = defaultdict(int)

    # First pass: find native mobile (Android + iOS) module roots from all file
    # paths so Kotlin/Java/Swift/Objective-C files under them are classified as
    # mobile rather than backend.
    mobile_roots = detect_mobile_roots(
        f.get('path')
        for commit in commits_data
        for f in commit.get('modified_files', [])
    )

    for commit in commits_data:
        dev = commit['author_email']
        total_commits[dev] += 1

        # Keyword scores
        kw = get_keyword_scores(commit.get('message', ''))
        for role, hit in kw.items():
            keyword_hits[dev][role] += hit

        # File modifications. Weight by lines *added* (authorship), not added +
        # deleted: deleting a large file is not the same as writing it, and
        # churn would credit a deleter as a heavy contributor to that category.
        for f in commit.get('modified_files', []):
            category = get_file_category(f.get('path'), mobile_roots)
            lines    = f.get('added', 0) or 0
            lines_by_category[dev][category] += lines

    rows = []
    for dev in total_commits:
        if total_commits[dev] < MIN_COMMITS:
            continue

        total_lines = sum(lines_by_category[dev].values())
        n_commits = total_commits[dev]

        # Percentages per category (safe divide — fall back to keyword-only if no line data)
        if total_lines > 0:
            pct = {cat: lines_by_category[dev][cat] / total_lines for cat in CATEGORIES}
        else:
            pct = {cat: 0.0 for cat in CATEGORIES}

        # Combined backend
        pct_backend = (pct['backend_py'] + pct['backend_java'] +
                       pct['backend_js'] + pct['backend_sys'])
        pct_mobile = pct['mobile']

        # Keyword ratios
        kw_scores = {role: keyword_hits[dev][role] / n_commits for role in KEYWORDS}

        role = assign_role(
            frontend=pct['frontend'],
            backend=pct_backend,
            test=pct['test'],
            devops=pct['devops'],
            mobile=pct_mobile
        )

        specialization = _specialization_index({
            'frontend': pct['frontend'], 'backend': pct_backend,
            'mobile': pct_mobile, 'test': pct['test'],
            'devops': pct['devops'], 'docs': pct['docs'], 'build': pct['build'],
        })
        confidence = _role_confidence(
            [pct['frontend'], pct_backend, pct_mobile, pct['test'], pct['devops']]
        )

        rows.append({
            'developer':    dev,
            'total_commits': n_commits,
            'total_lines':  total_lines,
            'pct_frontend': round(pct['frontend'], 3),
            'pct_backend':  round(pct_backend, 3),
            'pct_mobile':   round(pct_mobile, 3),
            'pct_test':     round(pct['test'], 3),
            'pct_devops':   round(pct['devops'], 3),
            'pct_docs':     round(pct['docs'], 3),
            'pct_build':    round(pct['build'], 3),
            'kw_frontend':  round(kw_scores['frontend'], 3),
            'kw_backend':   round(kw_scores['backend'], 3),
            'kw_test':      round(kw_scores['test'], 3),
            'kw_devops':    round(kw_scores['devops'], 3),
            'kw_docs':      round(kw_scores['docs'], 3),
            'role':         role,
            'specialization': specialization,
            'role_confidence': confidence,
        })

    return rows
