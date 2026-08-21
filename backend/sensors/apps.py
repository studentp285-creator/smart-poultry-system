import os
from django.apps import AppConfig


class SensorsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sensors'

    def ready(self):
        # runserver's autoreloader loads this module twice (once in the
        # watcher process, once in the actual server process) — only start
        # the background thread in the real one.
        if os.environ.get('RUN_MAIN') != 'true':
            return
        from . import device_watch
        device_watch.start()
