"use client";

import { Workspace, WorkspaceType } from "@/types/workspace";
import { Calendar, Clock, Users, MapPin } from "lucide-react";

interface WorkspaceDetailProps {
  workspace: Workspace;
}

export function WorkspaceDetail({ workspace }: WorkspaceDetailProps) {
  const getTypeBadgeColor = (type: WorkspaceType) => {
    switch (type) {
      case "office":
        return "bg-blue-100 text-blue-800";
      case "meeting-room":
        return "bg-green-100 text-green-800";
      case "desk":
        return "bg-yellow-100 text-yellow-800";
      case "conference-room":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
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
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(workspace.type)}`}>
            {workspace.type.replace("-", " ")}
          </span>
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
  );
}