"""
Twilio WhatsApp notification service.

Required environment variables in backend/.env:
    TWILIO_ACCOUNT_SID   = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_AUTH_TOKEN    = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_WHATSAPP_FROM = whatsapp:+14155238886   (Twilio sandbox number)

The recipient must have joined the Twilio WhatsApp sandbox by sending
    join <your-keyword>
to +1 415 523 8886 on WhatsApp before messages can be delivered.
"""

import os

_SID   = os.environ.get('TWILIO_ACCOUNT_SID',   '').strip()
_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN',     '').strip()
_FROM  = os.environ.get('TWILIO_WHATSAPP_FROM',  'whatsapp:+14155238886').strip()


def is_configured() -> bool:
    """True when Twilio credentials are present in the environment."""
    return bool(_SID and _TOKEN)


def send(message: str, to_number: str) -> tuple[bool, str]:
    """
    Send a WhatsApp message via Twilio.
    to_number: E.164 format (+260971234567) — 'whatsapp:' prefix added automatically.
    Returns (success: bool, detail: str)  — detail is SID on success, error on failure.
    """
    if not is_configured():
        return False, 'Twilio credentials not configured in backend/.env'
    if not to_number or not to_number.strip():
        return False, 'No WhatsApp number saved in settings'

    try:
        from twilio.rest import Client
        client = Client(_SID, _TOKEN)
        to = to_number if to_number.startswith('whatsapp:') else f'whatsapp:{to_number}'
        msg = client.messages.create(body=message, from_=_FROM, to=to)
        return True, msg.sid
    except Exception as exc:
        return False, str(exc)
