"""Shared bot and non-human account detection.

A single detector used by both the activity pipeline (analyzer.clean_data) and
the skill pipeline (skill_service) so the two agree on who is a bot. The goal
is high recall: catch as many automated or non-human committers as possible
(CI, dependency updaters, code-quality bots, translation services, release
automation) while not flagging ordinary contributors whose name merely
contains a substring such as "robot" or "abuild".

A developer id may be a name, an email, or "name <email>". All checks are
case-insensitive.
"""

import re

# Exact automated identities seen in the wild (matched as substrings of the id).
# These are unambiguous: if the id contains one of these, it is a bot.
_BOT_SUBSTRINGS = {
    "[bot]",                # GitHub App marker: dependabot[bot], allcontributors[bot], ...
    "dependabot",
    "renovate",
    "greenkeeper",
    "snyk-bot", "snyk-io",
    "imgbot",
    "github-actions",
    "gitlab-bot", "gitlab-ci",
    "semantic-release",
    "mergify",
    "deepsource",
    "codecov",
    "coveralls",
    "allcontributors",
    "pre-commit-ci",
    "pyup-bot", "pyup.io",
    "whitesource",
    "fossabot",
    "stale[bot]", "stale-bot",
    "netlify",
    "vercel",
    "now-bot",
}

# Translation / localisation services. Their commits are machine-generated
# string updates, not authored code, so they distort role detection.
# Note: a bare "noreply" address is NOT listed here, because GitHub gives real
# users a "<name>@users.noreply.github.com" privacy address. Only service
# aliases and the explicit bot patterns below are treated as non-human.
_SERVICE_SUBSTRINGS = {
    "weblate",
    "transifex",
    "crowdin",
    "lokalise",
    "pontoon",
    "l10n@",          # common localisation alias
    "translate@",
    "localization@", "localisation@",
}

# Whole-word automation tokens. Matched only at word boundaries (not inside a
# larger word) so legitimate names like "abuild", "cicero", or "robotnik" are
# not flagged. Bare "ci"/"cd" are deliberately excluded: they are too short and
# collide with human email local parts (e.g. "nicholas.ci.dev"). They are only
# matched as part of a hyphenated automation token below.
_BOT_WORD_RE = re.compile(
    r'(?<![a-z0-9])(bot|automation|autobuild|build-?bot|robot|'
    r'ci-?runner|ci-?bot|ci-?build|gitlab-?ci|circle-?ci|'
    r'service-?account|jenkins|travis|appveyor|teamcity|'
    r'release-?bot|auto-?merge)(?![a-z0-9])',
    re.IGNORECASE,
)


def is_bot(developer_id):
    """Return True if the developer id looks like a bot or non-human account."""
    if not developer_id:
        return False
    name = str(developer_id).lower()

    if any(s in name for s in _BOT_SUBSTRINGS):
        return True
    if any(s in name for s in _SERVICE_SUBSTRINGS):
        return True
    if _BOT_WORD_RE.search(name):
        return True
    return False
