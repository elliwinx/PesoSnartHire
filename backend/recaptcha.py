import os
import requests

RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"
RECAPTCHA_SECRET_KEY = os.environ.get("RECAPTCHA_SECRET_KEY")

def verify_recaptcha(response_token, remote_ip=None):
    if not RECAPTCHA_SECRET_KEY:
        return {"success": False, "error-codes": ["missing-secret-key"]}

    payload = {"secret": RECAPTCHA_SECRET_KEY, "response": response_token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        r = requests.post(RECAPTCHA_VERIFY_URL, data=payload, timeout=5)
        return r.json()
    except Exception as e:
        return {"success": False, "error-codes": ["request-error", str(e)]}
