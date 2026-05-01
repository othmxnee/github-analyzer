from flask import Blueprint, request, jsonify
from services.analyzer import (
    get_analysis_result,
    get_architecture,
    get_busfactor_simulation,
    get_project_summary_data,
    get_treemap_data,
    get_voronoi_data,
    start_analysis,
)
from services.skill_service import analyze_skills, get_skills_result

analyze_bp = Blueprint('analyze', __name__)


def _validate_github_url(repo_url):
    return isinstance(repo_url, str) and repo_url.startswith('https://github.com/')


@analyze_bp.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        if not data or 'repo_url' not in data:
            return jsonify({'error': 'repo_url is required'}), 400
        repo_url = data['repo_url']
        if not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid GitHub URL'}), 400

        return jsonify(start_analysis(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/analyze/result', methods=['GET'])
def analyze_result():
    try:
        repo_url = request.args.get('repo_url')
        if not repo_url or not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid GitHub URL'}), 400
        return jsonify(get_analysis_result(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/architecture', methods=['GET'])
def architecture():
    try:
        repo_url = request.args.get('repo_url')
        if repo_url and not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid GitHub URL'}), 400
        return jsonify(get_architecture(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/busfactor/simulation', methods=['GET'])
def busfactor_simulation():
    try:
        repo_url = request.args.get('repo_url')
        if repo_url and not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid GitHub URL'}), 400
        return jsonify(get_busfactor_simulation(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/project-summary', methods=['GET'])
def project_summary():
    try:
        repo_url = request.args.get('repo_url')
        if repo_url and not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid GitHub URL'}), 400
        return jsonify(get_project_summary_data(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/treemap', methods=['GET'])
def treemap():
    try:
        repo_url = request.args.get('repo_url')
        if repo_url and not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid GitHub URL'}), 400
        return jsonify(get_treemap_data(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/voronoi', methods=['GET'])
def voronoi():
    try:
        repo_url = request.args.get('repo_url')
        if repo_url and not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid GitHub URL'}), 400
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
            return jsonify({'error': 'Invalid GitHub URL'}), 400
        result = analyze_skills(repo_url)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/analyze/skills/result', methods=['GET'])
def skills_result():
    try:
        repo_url = request.args.get('repo_url')
        if not repo_url or not _validate_github_url(repo_url):
            return jsonify({'error': 'Invalid GitHub URL'}), 400
        return jsonify(get_skills_result(repo_url))
    except Exception as e:
        return jsonify({'error': str(e)}), 500
