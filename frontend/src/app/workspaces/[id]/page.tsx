"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Users, MapPin } from "lucide-react";
import { Workspace, BookingFormData } from "@/types/workspace";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/authStore";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface WorkspaceResponse {
  workspace: Workspace;
}

function BookingForm({ workspace }: { workspace: Workspace }) {
  const { token } = useAuthStore();
  const { showToast } = useToast();
  const [isBooking, setIsBooking] = useState(false);
  const [formData, setFormData] = useState({
    startTime: "",
    endTime: "",
  });

  const calculateTotal = () => {
    if (!formData.startTime || !formData.endTime) return 0;
    const start = new Date(formData.startTime);
    const end = new Date(formData.endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.max(0, hours * workspace.pricePerHour);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      showToast("error", "Please log in to book a workspace");
      return;
    }

    setIsBooking(true);
    try {
      await api.createBooking(token, {
        workspaceId: workspace.id,
        startTime: formData.startTime,
        endTime: formData.endTime,
      });
      showToast("success", "Booking created successfully");
      setFormData({ startTime: "", endTime: "" });
    } catch (error) {
      showToast("error", "Failed to create booking");
    } finally {
      setIsBooking(false);
    }
  };

  const total = calculateTotal();

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Book This Workspace</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Start Time</label>
          <Input
            type="datetime-local"
            value={formData.startTime}
            onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">End Time</label>
          <Input
            type="datetime-local"
            value={formData.endTime}
            onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
            required
          />
        </div>
        {total > 0 && (
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-sm text-gray-600">Total Price</p>
            <p className="text-lg font-semibold">${total.toFixed(2)}</p>
          </div>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={isBooking || !workspace.availability}
        >
          {isBooking ? "Booking..." : workspace.availability ? "Confirm Booking" : "Unavailable"}
        </Button>
      </form>
    </div>
  );
}

export default function WorkspaceDetailPage() {
  const params = useParams();
  const workspaceId = params.id as string;

  const { data, isLoading } = useQuery<WorkspaceResponse>({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api.getWorkspace(workspaceId),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading workspace...</div>;
  }

  if (!data?.workspace) {
    return <div className="p-8 text-center">Workspace not found</div>;
  }

  const workspace = data.workspace;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Images */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="h-64 bg-gray-200 flex items-center justify-center">
              {workspace.images?.[0] ? (
                <img
                  src={workspace.images[0]}
                  alt={workspace.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-gray-500">No Image</div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-4">{workspace.name}</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="flex items-center">
                <Users className="h-5 w-5 mr-2 text-gray-500" />
                <span className="text-sm">Capacity: {workspace.capacity}</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-5 w-5 mr-2 text-gray-500" />
                <span className="text-sm">${workspace.pricePerHour}/hour</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-gray-500" />
                <span className="text-sm">
                  {workspace.availability ? (
                    <span className="text-green-600">Available</span>
                  ) : (
                    <span className="text-red-600">Unavailable</span>
                  )}
                </span>
              </div>
              <div className="flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-gray-500" />
                <span className="text-sm capitalize">{workspace.type.replace("-", " ")}</span>
              </div>
            </div>

            {workspace.description && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p className="text-gray-700">{workspace.description}</p>
              </div>
            )}

            {workspace.amenities && workspace.amenities.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {workspace.amenities.map((amenity, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Booking Form */}
        <div className="lg:col-span-1">
          <BookingForm workspace={workspace} />
        </div>
      </div>
    </div>
  );
}