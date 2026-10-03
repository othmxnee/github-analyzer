"""Company-wide view of the signed-in user's watched repositories.

GET /portfolio          repositories, riskiest first, with change since last run
GET /portfolio/people   developers who are critical owners across repositories
"""
from flask import Blueprint, jsonify

from routes.watch import _current_user
from services import portfolio, store

portfolio_bp = Blueprint('portfolio', __name__)


@portfolio_bp.route('/portfolio', methods=['GET'])
def portfolio_repositories():
    provider, login = _current_user()
    if not login:
        return jsonify({'error': 'Sign in to see your repositories.'}), 401
    if not store.enabled():
        return jsonify({'enabled': False, 'repositories': []})
    return jsonify({'enabled': True, 'repositories': portfolio.repositories(provider, login)})


@portfolio_bp.route('/portfolio/people', methods=['GET'])
def portfolio_people():
    provider, login = _current_user()
    if not login:
        return jsonify({'error': 'Sign in to see your repositories.'}), 401
    if not store.enabled():
        return jsonify({'enabled': False, 'people': []})
    return jsonify({'enabled': True, 'critical_share': portfolio.CRITICAL_SHARE,
                    'people': portfolio.people(provider, login)})
