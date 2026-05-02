from rest_framework.views import exception_handler
from rest_framework.response import Response


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        data = response.data
        message = "Request failed."
        errors = None
        if isinstance(data, dict):
            if "detail" in data:
                message = str(data["detail"])
            else:
                message = "Validation error."
                errors = data
        elif isinstance(data, list):
            message = str(data[0]) if data else message
        response.data = {
            "success": False,
            "data": {},
            "message": message,
        }
        if errors is not None:
            response.data["errors"] = errors
    return response
