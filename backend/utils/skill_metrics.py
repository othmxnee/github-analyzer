import os
from collections import defaultdict

# ---------- File extension classification ----------
FRONTEND_EXTENSIONS  = {'.css', '.html', '.scss', '.vue'}
BACKEND_PY_EXT       = {'.py'}
BACKEND_JAVA_EXT     = {'.java', '.kt', '.scala'}
DEVOPS_EXTENSIONS    = {'.yml', '.yaml', '.sh', '.dockerfile', '.toml', '.cfg', '.ini'}
BUILD_FILES          = {'pom.xml', 'build.gradle', 'requirements.txt', 'setup.py',
                        'setup.cfg', 'pyproject.toml', 'package.json', 'build.xml'}
DOC_EXTENSIONS       = {'.md', '.rst', '.txt', '.adoc'}

DEVOPS_FILENAMES     = {'dockerfile', 'jenkinsfile', 'makefile', '.travis.yml',
                        'docker-compose.yml', 'docker-compose.yaml'}

TEST_FOLDER_KEYWORDS = {'test', 'tests', 'spec', 'specs', '__tests__'}

BACKEND_FOLDERS  = {'server', 'backend', 'api', 'services', 'routes',
                    'controllers', 'models', 'db', 'database', 'middleware',
                    'worker', 'queue', 'core', 'lib', 'src'}
MOBILE_EXTENSIONS = {'.swift', '.kt', '.dart'}
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

# ---------- Role thresholds ----------
THRESHOLDS = {
    'tester':    0.25,
    'devops':    0.20,
    'fullstack': 0.25,
    'frontend':  0.40,
    'backend':   0.35,
    'mobile':    0.25,
}

CATEGORIES = ['frontend', 'backend_py', 'backend_java',
              'backend_js', 'mobile', 'test', 'devops', 'build', 'docs', 'other']

MIN_COMMITS = 2  # minimum commits to assign a role


def get_file_category(filepath):
    """Classify a file path into a category."""
    if filepath is None:
        return 'other'

    path_lower = filepath.lower()
    filename   = os.path.basename(path_lower)
    ext        = os.path.splitext(filename)[1]
    parts      = path_lower.replace('\\', '/').split('/')
    parts_set  = set(parts)

    # Test
    if parts_set & TEST_FOLDER_KEYWORDS:
        return 'test'
    if (filename.startswith('test_') or filename.endswith('_test.py') or
            filename.endswith('test.java') or 'spec' in filename):
        return 'test'

    # DevOps
    if filename in DEVOPS_FILENAMES or ext in DEVOPS_EXTENSIONS:
        return 'devops'

    # Build
    if filename in BUILD_FILES:
        return 'build'

    # Python / Java always backend
    if ext in BACKEND_PY_EXT:
        return 'backend_py'
    if ext in BACKEND_JAVA_EXT:
        return 'backend_java'

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
    """Return keyword match dict for a commit message."""
    if not message:
        return {role: 0 for role in KEYWORDS}
    msg = message.lower()
    return {role: 1 if any(kw in msg for kw in kws) else 0
            for role, kws in KEYWORDS.items()}


def assign_role(frontend, backend, test, devops, mobile):
    if test >= 0.40 and test > backend and test > frontend:
        return 'Tester'
    if devops >= THRESHOLDS['devops'] and devops > backend and devops > frontend:
        return 'DevOps'
    if mobile >= THRESHOLDS['mobile']:
        return 'Mobile'
    if frontend >= THRESHOLDS['fullstack'] and backend >= THRESHOLDS['fullstack']:
        return 'Full Stack'
    if frontend >= THRESHOLDS['frontend']:
        return 'Frontend'
    if backend  >= THRESHOLDS['backend']:
        return 'Backend'
    return 'Generalist'


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

    for commit in commits_data:
        dev = commit['author_email']
        total_commits[dev] += 1

        # Keyword scores
        kw = get_keyword_scores(commit.get('message', ''))
        for role, hit in kw.items():
            keyword_hits[dev][role] += hit

        # File modifications
        for f in commit.get('modified_files', []):
            category = get_file_category(f.get('path'))
            lines    = (f.get('added', 0) or 0) + (f.get('deleted', 0) or 0)
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
        pct_backend = pct['backend_py'] + pct['backend_java'] + pct['backend_js']
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
        })

    return rows
