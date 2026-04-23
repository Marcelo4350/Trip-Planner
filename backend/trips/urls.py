from django.urls import path
from .views import PlanTripView, GeocodeView, TripListCreateView, TripDetailView

urlpatterns = [
    path("plan-trip/", PlanTripView.as_view(), name="plan-trip"),
    path("geocode/", GeocodeView.as_view(), name="geocode"),
    path("trips/", TripListCreateView.as_view(), name="trip-list"),
    path("trips/<int:pk>/", TripDetailView.as_view(), name="trip-detail"),
]
