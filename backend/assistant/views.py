from rest_framework import generics


class StartSesssionView(generics.CreateAPIView):

    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)
    

class EndSesssionView(generics.CreateAPIView):

    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)
    

class SessionMessageView(generics.CreateAPIView):

    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)