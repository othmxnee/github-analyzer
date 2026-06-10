from flask import Blueprint, request, jsonify, session
from services.analyzer import (
    get_analysis_result,
    get_architecture,
    get_busfactor_simulation,
    get_developer_emails,
    get_project_summary_data,
    get_voronoi_data,
    start_analysis,
)
from services.avatar_service import start_avatar_job, get_avatar_result
from services.skill_service import analyze_skills, get_skills_result
from services.timeline_service import compute_metric, list_metrics

analyze_bp = Blueprint('analyze', __name__)

# Hosts we know how to clone + inject tokens for. Public repos on these hosts
# work without sign-in; private repos use the matching provider's session token.
_HOST_TO_PROVIDER = {
    'https://github.com/':    'github',
    'https://gitlab.com/':    'gitlab',
    'https://bitbucket.org/': 'bitbucket',
}


def _provider_for_url(repo_url):
    if not isinstance(repo_url, str):
        return None
    for prefix, provider in _HOST_TO_PROVIDER.items():
        if repo_url.startswith(prefix):
            return provider
    return None


def _validate_repo_url(repo_url):
    return _provider_for_url(repo_url) is not None


# Backwards-compat alias — some places may still call this name.
def _validate_github_url(repo_url):
    return _validate_repo_url(repo_url)


@analyze_bp.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        if not data or 'repo_url' not in data:
            return jsonify({'error': 'repo_url is required'}), 400
        repo_url = data['repo_url']
        if not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid repository URL. Supported hosts: github.com, gitlab.com, bitbucket.org'}), 400
        force = bool(data.get('force', False))
        provider = _provider_for_url(repo_url)
        token = session.get(f'{provider}_token') if provider else None
        return jsonify(start_analysis(repo_url, force=force, token=token, provider=provider))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/analyze/result', methods=['GET'])
def analyze_result():
    try:
        repo_url = request.args.get('repo_url')
        if not repo_url or not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid repository URL. Supported hosts: github.com, gitlab.com, bitbucket.org'}), 400
        return jsonify(get_analysis_result(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/architecture', methods=['GET'])
def architecture():
    try:
        repo_url = request.args.get('repo_url')
        if repo_url and not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid repository URL. Supported hosts: github.com, gitlab.com, bitbucket.org'}), 400
        return jsonify(get_architecture(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/busfactor/simulation', methods=['GET'])
def busfactor_simulation():
    try:
        repo_url = request.args.get('repo_url')
        if repo_url and not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid repository URL. Supported hosts: github.com, gitlab.com, bitbucket.org'}), 400
        return jsonify(get_busfactor_simulation(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/project-summary', methods=['GET'])
def project_summary():
    try:
        repo_url = request.args.get('repo_url')
        if repo_url and not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid repository URL. Supported hosts: github.com, gitlab.com, bitbucket.org'}), 400
        return jsonify(get_project_summary_data(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/voronoi', methods=['GET'])
def voronoi():
    try:
        repo_url = request.args.get('repo_url')
        if repo_url and not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid repository URL. Supported hosts: github.com, gitlab.com, bitbucket.org'}), 400
        return jsonify(get_voronoi_data(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/analyze/skills', methods=['POST'])
def skills():
    try:
        data = request.get_json()
        if not data or 'repo_url' not in data:
            return jsonify({'error': 'repo_url is required'}), 400
        repo_url = data['repo_url']
        if not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid repository URL. Supported hosts: github.com, gitlab.com, bitbucket.org'}), 400
        result = analyze_skills(repo_url)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/analyze/avatars', methods=['POST'])
def avatars():
    """Kick off the background job that resolves real GitHub profile photos.

    Called by the dashboard after analysis. Resolves every developer's avatar
    without blocking; the frontend polls /analyze/avatars/result for the
    growing map. Needs the repo to be analyzed (we read its developer emails).
    """
    try:
        data = request.get_json() or {}
        repo_url = data.get('repo_url')
        if not repo_url or not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid repository URL.'}), 400
        force = bool(data.get('force'))
        provider = _provider_for_url(repo_url)
        token = session.get(f'{provider}_token') if provider else None
        emails = get_developer_emails(repo_url)
        if not emails:
            # Repo not analyzed yet — nothing to resolve.
            return jsonify({'status': 'not_started', 'avatars': {}})
        start_avatar_job(repo_url, emails, token=token, force=force)
        return jsonify(get_avatar_result(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/analyze/avatars/result', methods=['GET'])
def avatars_result():
    try:
        repo_url = request.args.get('repo_url')
        if not repo_url or not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid repository URL.'}), 400
        return jsonify(get_avatar_result(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/metric/<metric>', methods=['GET'])
def metric_timeline(metric):
    """Windowed metric endpoint — re-slices cached cleaned data by date.

    Query params:
      repo_url  — required, must match an already-analyzed repo
      start     — ISO date (YYYY-MM-DD), optional (open-ended)
      end       — ISO date (YYYY-MM-DD), optional (open-ended)
      compare   — '1'/'true' to also return the previous period of equal length
    """
    try:
        repo_url = request.args.get('repo_url')
        if not repo_url or not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid repository URL.'}), 400

        start        = request.args.get('start') or None
        end          = request.args.get('end')   or None
        compare      = (request.args.get('compare') or '').lower() in ('1', 'true', 'yes')
        compare_mode = (request.args.get('compare_mode') or 'previous').lower()

        result = compute_metric(
            repo_url, metric,
            start=start, end=end,
            compare=compare, compare_mode=compare_mode,
        )
        return jsonify(result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/metric', methods=['GET'])
def metric_list():
    return jsonify({"metrics": list_metrics()})


@analyze_bp.route('/analyze/skills/result', methods=['GET'])
def skills_result():
    try:
        repo_url = request.args.get('repo_url')
        if not repo_url or not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid repository URL. Supported hosts: github.com, gitlab.com, bitbucket.org'}), 400
        return jsonify(get_skills_result(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500
