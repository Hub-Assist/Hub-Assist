"use client";

import { Workspace, WorkspaceType } from "@/types/workspace";
import { Button } from "@/components/ui/Button";

interface WorkspaceCardProps {
  workspace: Workspace;
  onBookNow?: (workspace: Workspace) => void;
}

export function WorkspaceCard({ workspace, onBookNow }: WorkspaceCardProps) {
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="h-48 bg-gray-200 flex items-center justify-center">
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
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">{workspace.name}</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(workspace.type)}`}>
            {workspace.type.replace("-", " ")}
          </span>
        </div>
        <p className="text-gray-600 text-sm mb-2">
          Capacity: {workspace.capacity} • ${workspace.pricePerHour}/hour
        </p>
        <p className="text-gray-600 text-sm mb-4">
          {workspace.availability ? (
            <span className="text-green-600">Available</span>
          ) : (
            <span className="text-red-600">Unavailable</span>
          )}
        </p>
        <Button
          className="w-full"
          disabled={!workspace.availability}
          onClick={() => onBookNow?.(workspace)}
        >
          {workspace.availability ? "Book Now" : "Unavailable"}
        </Button>
      </div>
    </div>
  );
}