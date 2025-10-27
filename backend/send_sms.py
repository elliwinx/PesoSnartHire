import os
import time
import requests
from dotenv import load_dotenv

# Load .env from the backend folder
env_path = os.path.join(os.path.dirname(__file__), '.env')
if not os.path.exists(env_path):
    # fallback: parent folder's backend directory
    env_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')

load_dotenv(dotenv_path=env_path)


_last_request_time = 0
_min_request_interval = 0.5


def format_phone_number(phone_number):
    """
    Format phone numbers for httpsms API.
    Converts to international format with + prefix.

    Examples:
    - "09050759425" -> "+639050759425"
    - "9050759425" -> "+639050759425"
    - "+639050759425" -> "+639050759425"
    - "639050759425" -> "+639050759425"
    """
    if not phone_number:
        return None

    # Remove all non-digit characters except leading +
    cleaned = phone_number.lstrip('+')
    cleaned = ''.join(c for c in cleaned if c.isdigit())

    # Handle Philippine numbers (add country code 63 if needed)
    if cleaned.startswith('0'):
        # Remove leading 0 and add country code
        cleaned = '63' + cleaned[1:]
    elif not cleaned.startswith('63'):
        # Assume it's a Philippine number if no country code
        cleaned = '63' + cleaned

    # Add + prefix for international format
    formatted = '+' + cleaned

    # Validate length (most numbers are 10-15 digits after country code)
    if len(cleaned) < 10 or len(cleaned) > 15:
        print(f"[v0] Warning: Phone number might be invalid - {formatted}")

    return formatted


def check_httpsms_status():
    """
    Check httpsms API connectivity and authentication.
    """
    api_key = os.getenv("HTTPSMS_API_KEY")
    from_number = os.getenv("HTTPSMS_FROM_NUMBER")

    print("\n=== HTTPSMS DEBUG CHECK ===")
    print(f"[v0] API Key configured: {'Yes' if api_key else 'NO - MISSING'}")
    print(
        f"[v0] From Number configured: {from_number if from_number else 'NO - MISSING'}")

    if not api_key or not from_number:
        print("[v0] ERROR: Missing required environment variables!")
        return False

    # Test API connectivity
    try:
        url = "https://api.httpsms.com/v1/messages/send"
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json"
        }

        # Send a test request with minimal payload to check auth
        test_payload = {
            "from": format_phone_number(from_number),
            "to": "+639999999999",  # Dummy number
            "content": "test"
        }

        response = requests.post(
            url, json=test_payload, headers=headers, timeout=5)

        if response.status_code == 200:
            print("[v0] ✓ API authentication successful")
            return True
        elif response.status_code == 401:
            print("[v0] ✗ ERROR: Invalid API key (401 Unauthorized)")
            print(f"[v0] Response: {response.text}")
            return False
        elif response.status_code == 400:
            print("[v0] ✓ API reachable (400 is expected for test payload)")
            return True
        else:
            print(f"[v0] API returned status {response.status_code}")
            print(f"[v0] Response: {response.text}")
            return True

    except Exception as e:
        print(f"[v0] ✗ ERROR: Cannot reach httpsms API: {e}")
        return False


def send_sms(to_number, message, from_number=None, max_retries=2):
    """
    Send SMS via httpsms API with enhanced debugging.
    """
    global _last_request_time

    try:
        # Validate inputs
        if not to_number or not message:
            print(
                f"[v0] Error: Invalid inputs - to_number={to_number}, message_length={len(message) if message else 0}")
            return False

        # Get API key
        api_key = os.getenv("HTTPSMS_API_KEY")
        if not api_key:
            print(f"[v0] Error: HTTPSMS_API_KEY not set in environment variables")
            return False

        # Get sender phone number (required for httpsms)
        if not from_number:
            from_number = os.getenv("HTTPSMS_FROM_NUMBER")

        if not from_number:
            print(
                f"[v0] Error: from_number not provided and HTTPSMS_FROM_NUMBER not set")
            return False

        formatted_to = format_phone_number(to_number)
        formatted_from = format_phone_number(from_number)

        if not formatted_to or not formatted_from:
            print(f"[v0] Error: Invalid phone number format")
            return False

        print(f"\n[v0] === SMS SEND ATTEMPT ===")
        print(f"[v0] From: {formatted_from}")
        print(f"[v0] To: {formatted_to}")
        print(f"[v0] Message length: {len(message)} characters")
        print(
            f"[v0] IMPORTANT: Verify that {formatted_from} is registered in httpsms Android app!")

        # Rate limiting
        current_time = time.time()
        time_since_last_request = current_time - _last_request_time
        if time_since_last_request < _min_request_interval:
            sleep_time = _min_request_interval - time_since_last_request
            time.sleep(sleep_time)

        _last_request_time = time.time()

        # httpsms API endpoint
        url = "https://api.httpsms.com/v1/messages/send"

        # Prepare headers
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json"
        }

        # Prepare payload
        payload = {
            "from": formatted_from,
            "to": formatted_to,
            "content": message
        }

        # Send SMS with retry logic
        for attempt in range(max_retries + 1):
            try:
                response = requests.post(
                    url, json=payload, headers=headers, timeout=10)

                print(f"[v0] API Response Status: {response.status_code}")

                if response.status_code == 200:
                    response_data = response.json()

                    status = response_data.get(
                        'data', {}).get('status', 'unknown')
                    print(f"[v0] Message Status: {status}")

                    if status == 'pending':
                        print(f"[v0] ⚠ WARNING: Message queued but NOT sent yet!")
                        print(
                            f"[v0] This means the httpsms Android app hasn't sent it yet.")
                        print(f"[v0] Check:")
                        print(
                            f"[v0]   1. Is the httpsms app running on the sender phone?")
                        print(
                            f"[v0]   2. Is {formatted_from} registered in the app?")
                        print(f"[v0]   3. Does the phone have cellular signal?")
                        print(f"[v0]   4. Does the SIM have SMS capability?")
                    elif status == 'sent':
                        print(f"[v0] ✓ SMS sent successfully!")
                    elif status == 'delivered':
                        print(f"[v0] ✓ SMS delivered!")

                    print(f"[v0] Full response: {response_data}")
                    return True
                else:
                    error_msg = response.text
                    print(
                        f"[v0] API Error (Attempt {attempt + 1}/{max_retries + 1}): Status {response.status_code}")
                    print(f"[v0] Error details: {error_msg}")

                    # Retry on specific status codes
                    if attempt < max_retries and response.status_code in [429, 500, 502, 503, 504]:
                        retry_delay = 2 ** attempt
                        print(f"[v0] Retrying in {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        continue

                    return False

            except requests.exceptions.Timeout:
                print(
                    f"[v0] Request timeout (Attempt {attempt + 1}/{max_retries + 1})")
                if attempt < max_retries:
                    retry_delay = 2 ** attempt
                    print(f"[v0] Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    continue
                return False

            except requests.exceptions.RequestException as e:
                print(
                    f"[v0] Request error (Attempt {attempt + 1}/{max_retries + 1}): {e}")
                if attempt < max_retries:
                    retry_delay = 2 ** attempt
                    print(f"[v0] Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    continue
                return False

        return False

    except Exception as e:
        print(f"[v0] Unexpected error sending SMS: {type(e).__name__}: {e}")
        return False


# Test script
if __name__ == "__main__":
    # Run diagnostic check
    check_httpsms_status()

    # Test send
    print("\n[v0] Attempting to send test SMS...")
    send_sms("+639928037409", "Test message from httpsms")
