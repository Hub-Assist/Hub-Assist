import { render, screen } from "@testing-library/react";
import { 
  ConnectionIndicator, 
  CompactConnectionIndicator,
  type ConnectionStatus 
} from "../ConnectionIndicator";

describe("ConnectionIndicator", () => {
  describe("Connected status", () => {
    it("should render connected status correctly", () => {
      render(<ConnectionIndicator status="connected" />);
      
      expect(screen.getByText("Connected")).toBeInTheDocument();
      expect(screen.getByText("Real-time updates active")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveAttribute(
        "aria-label",
        "Connection status: Connected. Real-time updates active"
      );
    });

    it("should use green colors for connected status", () => {
      const { container } = render(<ConnectionIndicator status="connected" />);
      
      const statusContainer = container.querySelector('[role="status"]');
      expect(statusContainer).toHaveClass("bg-green-50");
      
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-green-600");
      
      const label = screen.getByText("Connected");
      expect(label).toHaveClass("text-green-600");
    });
  });

  describe("Polling status", () => {
    it("should render polling status correctly", () => {
      render(<ConnectionIndicator status="polling" />);
      
      expect(screen.getByText("Syncing")).toBeInTheDocument();
      expect(screen.getByText("Fetching latest data")).toBeInTheDocument();
    });

    it("should use blue colors and spinning animation for polling status", () => {
      const { container } = render(<ConnectionIndicator status="polling" />);
      
      const statusContainer = container.querySelector('[role="status"]');
      expect(statusContainer).toHaveClass("bg-blue-50");
      
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-blue-600", "animate-spin");
      
      const label = screen.getByText("Syncing");
      expect(label).toHaveClass("text-blue-600");
    });
  });

  describe("Backoff status", () => {
    it("should render backoff status with error count", () => {
      render(<ConnectionIndicator status="backoff" errorCount={2} />);
      
      expect(screen.getByText("Retrying")).toBeInTheDocument();
      expect(screen.getByText("Retry 2/3 - reconnecting...")).toBeInTheDocument();
    });

    it("should use yellow colors for backoff status", () => {
      const { container } = render(<ConnectionIndicator status="backoff" errorCount={1} />);
      
      const statusContainer = container.querySelector('[role="status"]');
      expect(statusContainer).toHaveClass("bg-yellow-50");
      
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-yellow-600");
      
      const label = screen.getByText("Retrying");
      expect(label).toHaveClass("text-yellow-600");
    });
  });

  describe("Disconnected status", () => {
    it("should render disconnected status correctly", () => {
      render(<ConnectionIndicator status="disconnected" />);
      
      expect(screen.getByText("Offline")).toBeInTheDocument();
      expect(screen.getByText("Connection lost - click to retry")).toBeInTheDocument();
    });

    it("should use red colors for disconnected status", () => {
      const { container } = render(<ConnectionIndicator status="disconnected" />);
      
      const statusContainer = container.querySelector('[role="status"]');
      expect(statusContainer).toHaveClass("bg-red-50");
      
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-red-600");
      
      const label = screen.getByText("Offline");
      expect(label).toHaveClass("text-red-600");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      render(<ConnectionIndicator status="connected" />);
      
      const statusElement = screen.getByRole("status");
      expect(statusElement).toHaveAttribute("aria-live", "polite");
      expect(statusElement).toHaveAttribute("aria-label");
      
      const icon = statusElement.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    it("should update aria-label based on status", () => {
      const { rerender } = render(<ConnectionIndicator status="connected" />);
      
      expect(screen.getByRole("status")).toHaveAttribute(
        "aria-label",
        "Connection status: Connected. Real-time updates active"
      );
      
      rerender(<ConnectionIndicator status="disconnected" />);
      
      expect(screen.getByRole("status")).toHaveAttribute(
        "aria-label",
        "Connection status: Offline. Connection lost - click to retry"
      );
    });
  });

  describe("Custom className", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <ConnectionIndicator status="connected" className="custom-class" />
      );
      
      const statusContainer = container.querySelector('[role="status"]');
      expect(statusContainer).toHaveClass("custom-class");
    });
  });
});

describe("CompactConnectionIndicator", () => {
  describe("Rendering", () => {
    it("should render connected status as icon only", () => {
      const { container } = render(<CompactConnectionIndicator status="connected" />);
      
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-green-600");
      expect(icon).toHaveAttribute("title", "Connected - Real-time updates active");
    });

    it("should render polling status with animation", () => {
      const { container } = render(<CompactConnectionIndicator status="polling" />);
      
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-blue-600", "animate-spin");
      expect(icon).toHaveAttribute("title", "Syncing - Fetching latest data");
    });

    it("should render backoff status with error count in title", () => {
      const { container } = render(
        <CompactConnectionIndicator status="backoff" errorCount={2} />
      );
      
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-yellow-600");
      expect(icon).toHaveAttribute("title", "Retrying 2/3 - reconnecting...");
    });

    it("should render disconnected status", () => {
      const { container } = render(<CompactConnectionIndicator status="disconnected" />);
      
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("text-red-600");
      expect(icon).toHaveAttribute("title", "Offline - Connection lost, click to retry");
    });
  });

  describe("Accessibility", () => {
    it("should have proper accessibility attributes", () => {
      const { container } = render(<CompactConnectionIndicator status="connected" />);
      
      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("role", "status");
      expect(icon).toHaveAttribute("aria-label", "Connected - Real-time updates active");
    });
  });

  describe("Custom className", () => {
    it("should apply custom className to icon", () => {
      const { container } = render(
        <CompactConnectionIndicator status="connected" className="custom-icon-class" />
      );
      
      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("custom-icon-class");
    });
  });

  describe("All status types", () => {
    const statuses: ConnectionStatus[] = ["connected", "polling", "backoff", "disconnected"];
    
    statuses.forEach((status) => {
      it(`should render ${status} status without errors`, () => {
        const { container } = render(
          <CompactConnectionIndicator 
            status={status} 
            errorCount={status === "backoff" ? 1 : 0} 
          />
        );
        
        const icon = container.querySelector("svg");
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute("title");
        expect(icon).toHaveAttribute("aria-label");
      });
    });
  });
});