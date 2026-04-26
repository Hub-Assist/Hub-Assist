import * as React from "react"
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react"

import { cn } from "@/lib/cn"

type ToastType = "success" | "error" | "warning"

interface ToastProps {
  type: ToastType
  message: string
  onClose?: () => void
}

const Toast: React.FC<ToastProps> = ({ type, message, onClose }) => {
  const [visible, setVisible] = React.useState(true)

  const handleClose = () => {
    setVisible(false)
    onClose?.()
  }

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onClose?.()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  if (!visible) return null

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
  }

  const colors = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  }

  const Icon = icons[type]

  return (
    <div className={cn("fixed top-4 right-4 z-50 max-w-sm w-full", colors[type], "border rounded-md p-4 shadow-lg")}>
      <div className="flex items-start">
        <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={handleClose}
          className="ml-3 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export { Toast }