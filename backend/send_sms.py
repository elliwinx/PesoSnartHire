import os
from dotenv import load_dotenv
import clicksend_client
from clicksend_client import SmsMessage
from clicksend_client.rest import ApiException

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

def send_sms(to_number, message):
    configuration = clicksend_client.Configuration()
    configuration.username = os.getenv("CLICKSEND_USERNAME")
    configuration.password = os.getenv("CLICKSEND_API_KEY")

    api_instance = clicksend_client.SMSApi(clicksend_client.ApiClient(configuration))

    sms_message = SmsMessage(source="python", body=message, to=to_number)
    sms_collection = clicksend_client.SmsMessageCollection(messages=[sms_message])

    try:
        response = api_instance.sms_send_post(sms_collection)
        print("SMS API Response:", response)
        return True
    except ApiException as e:
        print(f"Error sending SMS: {e}")
        return False
