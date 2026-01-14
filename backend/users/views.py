from django.db.models import Q, Value, CharField
from django.db.models.functions import Concat
from accounts.models import Caretaker, Student, HelpCategory
from accounts.permissions import IsApprovedCaretaker, IsStudent
from .serializers import StudentSerializer, CaretakerLongSerializer, CaretakerShortSerializer, CategoryWithSubcategoriesSerializer
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import get_object_or_404
from .serializers import (
    MeSerializer,
    UpdateUserSerializer,
    ChangePasswordSerializer,
    CaretakerUpdateSerializer,
    StudentUpdateSerializer
)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def help_categories(request):
    """Return help categories grouped with their direct subcategories."""
    roots = HelpCategory.objects.filter(parent__isnull=True).order_by('label')
    serializer = CategoryWithSubcategoriesSerializer(roots, many=True)
    return Response({"categories": serializer.data})


PAGE_SIZE = 20

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_caretakers(request):
    """Search caretakers by name and/or categories.

    Query params:
    - `name`: substring matched case-insensitively against first, last, or full name.
    - `categories`: repeatable category slugs; matches category or its direct subcategories.
    - `order`: `asc` (default) or `desc` to sort by last name.

    Response: paginated (page_size=20) `{count, next, previous, results}`.
    """
    query = request.GET.get("name", "").strip()
    categories_list = request.GET.getlist("categories")

    qs = Caretaker.objects.all()

    if query:
        qs = qs.annotate(
            full_name=Concat('user__first_name', Value(' '), 'user__last_name', output_field=CharField())
        ).filter(
            Q(user__first_name__icontains=query)
            | Q(user__last_name__icontains=query)
            | Q(full_name__icontains=query)
        )

    if categories_list:
        raw_slugs = [c.strip() for c in categories_list if c and c.strip()]
        if raw_slugs:
            found_slugs = []
            missing = []
            for s in raw_slugs:
                matched = HelpCategory.objects.filter(slug__iexact=s)
                if not matched.exists():
                    missing.append(s)
                    continue

                for cat in matched:
                    # include the category slug itself
                    if cat.slug and cat.slug not in found_slugs:
                        found_slugs.append(cat.slug)
                    # include direct subcategories' slugs
                    for sub in cat.subcategories.all():
                        if sub.slug and sub.slug not in found_slugs:
                            found_slugs.append(sub.slug)

            if missing:
                return Response({
                    "error": f"The following category slugs were not found: {', '.join(missing)}"
                }, status=status.HTTP_400_BAD_REQUEST)

            if found_slugs:
                qs = qs.filter(help_categories__slug__in=found_slugs)

    qs = qs.distinct()

    order_param = request.GET.get("order", "asc").strip().lower()
    if order_param == "desc":
        ordering = ["-user__last_name", "user__first_name", "user_id"]
    else:
        ordering = ["user__last_name", "user__first_name", "user_id"]

    qs = qs.order_by(*ordering)

    paginator = PageNumberPagination()
    paginator.page_size = PAGE_SIZE
    page = paginator.paginate_queryset(qs, request)

    serialized = CaretakerShortSerializer(page, many=True)
    return paginator.get_paginated_response(serialized.data)



@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def my_profile(request):
    user = request.user
    if request.method == "GET":
        serializer = MeSerializer(user)
        return Response(serializer.data)

    partial = request.method == "PATCH"
    serializer = UpdateUserSerializer(user, data=request.data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(MeSerializer(user).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    old = serializer.validated_data.get("old_password")
    if not user.check_password(old):
        return Response({"old_password": "Pogrešna trenutna lozinka."}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(serializer.validated_data.get("new_password"))
    user.save()
    return Response({"detail": "Lozinka je uspješno promijenjena."}, status=status.HTTP_200_OK)


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated, IsApprovedCaretaker])
def my_caretaker_profile(request):
    try:
        caretaker = request.user.caretaker
    except Caretaker.DoesNotExist:
        return Response({"detail": "Korisnik nije psiholog/caretaker."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(CaretakerShortSerializer(caretaker).data)

    partial = request.method == "PATCH"
    serializer = CaretakerUpdateSerializer(caretaker, data=request.data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(CaretakerShortSerializer(caretaker).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated, IsStudent])
def my_student_profile(request):
    try:
        student = request.user.student
    except Student.DoesNotExist:
        return Response({"detail": "Korisnik nije student."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(StudentSerializer(student).data)

    partial = request.method == "PATCH"
    serializer = StudentUpdateSerializer(student, data=request.data, partial=partial)
    if serializer.is_valid():
        serializer.save()
        return Response(StudentSerializer(student).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET"])
def caretaker_by_id(request, id):
    try:
        caretaker = Caretaker.objects.get(user_id=id)
    except:
        return Response({"error":f"No caretaker was found matching the specified ID ({id})."}, status=404)

    serialized = CaretakerLongSerializer(caretaker)
    return Response(serialized.data)


#jos se ne koristi
@api_view(["GET"])
def caretaker_by_slug(request, slug):
    return Response(f"slug: {id}")




