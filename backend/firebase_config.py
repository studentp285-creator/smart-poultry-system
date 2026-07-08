import os
import firebase_admin
from firebase_admin import credentials, db

_initialized = False


def get_firebase():
    global _initialized
    if not _initialized:
        key_path = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred, {
            'databaseURL': 'https://smart-poultry-bf401-default-rtdb.firebaseio.com'
        })
        _initialized = True
    return db
