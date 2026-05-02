from rest_framework.renderers import JSONRenderer


class EnvelopeJSONRenderer(JSONRenderer):
    """Wrap successful DRF payloads in { success, data, message } unless already wrapped."""

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            data = {}
        if isinstance(data, dict) and "success" in data:
            return super().render(data, accepted_media_type, renderer_context)
        view = renderer_context.get("view") if renderer_context else None
        message = getattr(view, "envelope_message", "Action completed.")
        wrapped = {"success": True, "data": data, "message": message}
        return super().render(wrapped, accepted_media_type, renderer_context)
