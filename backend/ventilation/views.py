import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

import firebase_service as fs


@api_view(['GET'])
def ventilation_status(request):
    data = fs.get_ventilation()
    return Response(data)


@api_view(['POST'])
def ventilation_control(request):
    action = request.data.get('action')
    if action not in ('open', 'close'):
        return Response({'error': 'action must be "open" or "close"'}, status=status.HTTP_400_BAD_REQUEST)
    is_open = action == 'open'
    reason = 'Manually opened by operator' if is_open else 'Manually closed by operator'
    fs.set_ventilation(is_open, 'manual', reason)
    return Response(fs.get_ventilation())
