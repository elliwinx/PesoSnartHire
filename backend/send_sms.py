import os
import time
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

_last_request_time = 0
_min_request_interval = 0.5  # Minimum 500ms between requests to avoid rate limiting


def format_ph_phone_number(phone_number):
    """
    Format Philippine phone numbers for Semaphore.
    Handles various input formats and converts to standard format.

    Examples:
    - "09050759425" -> "09050759425"
    - "9050759425" -> "09050759425"
    - "+639050759425" -> "09050759425"
    - "639050759425" -> "09050759425"
    """
    if not phone_number:
        return None

    # Remove all non-digit characters
    cleaned = ''.join(c for c in phone_number if c.isdigit())

    # Remove country code if present (63)
    if cleaned.startswith('63'):
        cleaned = cleaned[2:]

    # Ensure it starts with 0
    if not cleaned.startswith('0'):
        cleaned = '0' + cleaned

    # Validate length (PH numbers are 11 digits starting with 0)
    if len(cleaned) != 11 or not cleaned.startswith('0'):
        print(f"[v0] Warning: Phone number might be invalid - {cleaned}")

    return cleaned


def send_sms(to_number, message, max_retries=2):
    """
    Send SMS via Semaphore with proper error handling and retry logic.

    Args:
        to_number: Phone number (supports various PH formats)
        message: SMS message content
        max_retries: Number of retry attempts for failed requests

    Returns:
        bool: True if SMS sent successfully, False otherwise
    """
    global _last_request_time

    try:
        # Validate inputs
        if not to_number or not message:
            print(
                f"[v0] Error: Invalid inputs - to_number={to_number}, message_length={len(message) if message else 0}")
            return False

        # Get API key
        api_key = os.getenv("SEMAPHORE_API_KEY")
        if not api_key:
            print(f"[v0] Error: SEMAPHORE_API_KEY not set in environment variables")
            return False

        formatted_number = format_ph_phone_number(to_number)
        if not formatted_number:
            print(f"[v0] Error: Invalid phone number format - {to_number}")
            return False

        # Rate limiting
        current_time = time.time()
        time_since_last_request = current_time - _last_request_time
        if time_since_last_request < _min_request_interval:
            sleep_time = _min_request_interval - time_since_last_request
            time.sleep(sleep_time)

        _last_request_time = time.time()

        print(f"[v0] Sending SMS to: {formatted_number}")
        print(f"[v0] Message length: {len(message)} characters")

        # Semaphore API endpoint
        url = "https://api.semaphore.co/api/v4/messages"

        # Prepare payload
        payload = {
            "apikey": api_key,
            "number": formatted_number,
            "message": message,
            "sendername": "PESO"  # Set sender name to PESO
        }

        # Send SMS with retry logic
        for attempt in range(max_retries + 1):
            try:
                response = requests.post(url, data=payload, timeout=10)

                print(
                    f"[v0] Semaphore API Response Status: {response.status_code}")

                if response.status_code == 200:
                    response_data = response.json()
                    print(f"[v0] SMS sent successfully!")
                    print(f"[v0] Response: {response_data}")
                    return True
                else:
                    error_msg = response.text
                    print(
                        f"[v0] Semaphore API Error (Attempt {attempt + 1}/{max_retries + 1}): Status {response.status_code}")
                    print(f"[v0] Error details: {error_msg}")

                    # Retry on specific status codes
                    if attempt < max_retries and response.status_code in [429, 500, 502, 503, 504]:
                        retry_delay = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
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
