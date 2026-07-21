import logging
import os
import threading

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')

from extensions import limiter
from routes.analyze import analyze_bp
from routes.auth import auth_bp
from services.skill_service import warm_up_umap

IS_PRODUCTION = os.environ.get('FLASK_ENV') == 'production'

app = Flask(__name__)

app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')
if IS_PRODUCTION and app.secret_key == 'dev-secret-key-change-in-production':
    # Refuse to boot rather than sign sessions with a public constant: with a
    # known key any visitor can forge a session cookie and impersonate anyone.
    raise RuntimeError('FLASK_SECRET_KEY must be set to a real secret in production')

# The frontend is served from a different origin than the API in production, so
# the session cookie is cross-site and needs SameSite=None + Secure. Lax would
# make the browser silently withhold it and every OAuth login would fail.
app.config['SESSION_COOKIE_SAMESITE'] = 'None' if IS_PRODUCTION else 'Lax'
app.config['SESSION_COOKIE_SECURE'] = IS_PRODUCTION
app.config['SESSION_COOKIE_HTTPONLY'] = True

if IS_PRODUCTION:
    # Render terminates TLS at its proxy and forwards the real client IP in
    # X-Forwarded-For. Without this the rate limiter keys every request off the
    # proxy's single IP — i.e. one shared global limit — instead of per client.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

limiter.init_app(app)

# Comma-separated in production (e.g. "https://app.example.com"); defaults to the
# Vite dev server. Credentialed CORS forbids "*", so this must stay an explicit list.
_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000')
CORS(app, origins=[o.strip() for o in _origins.split(',') if o.strip()], supports_credentials=True)

app.register_blueprint(analyze_bp)
app.register_blueprint(auth_bp)


# Prime numba's JIT in the background so the first Developer Roles request does
# not pay ~tens of seconds of compilation. Threaded so gunicorn can bind the
# port immediately and Render's health check still passes right away.
threading.Thread(target=warm_up_umap, daemon=True).start()


@app.errorhandler(429)
def ratelimit_exceeded(e):
    # Flask-Limiter returns HTML by default; the frontend expects JSON with an
    # `error` field (see handleError in services/api.js).
    return jsonify({'error': 'Too many analyses from your network. Please wait a while and try again.'}), 429


@app.route('/health', methods=['GET'])
def health():
    return {'status': 'ok'}


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
