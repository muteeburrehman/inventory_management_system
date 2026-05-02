from rest_framework.response import Response


def success_response(data=None, message="Action completed.", status=200):
    return Response(
        {"success": True, "data": data if data is not None else {}, "message": message},
        status=status,
    )


def error_response(message, errors=None, status=400):
    body = {"success": False, "data": {}, "message": message}
    if errors is not None:
        body["errors"] = errors
    return Response(body, status=status)
