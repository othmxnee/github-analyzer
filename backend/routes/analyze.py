from flask import Blueprint, request, jsonify
from services.analyzer import (
    analyze_repo,
    get_architecture,
    get_busfactor_simulation,
    get_project_summary_data,
    get_treemap_data,
)

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
        
        results = analyze_repo(repo_url)
        
        return jsonify(results)
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        if not error_msg or error_msg == 'developer_id':
            error_msg = f"Analysis failed: {type(e).__name__}. Please check the repository URL and try again."
        return jsonify({'error': error_msg}), 500


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
