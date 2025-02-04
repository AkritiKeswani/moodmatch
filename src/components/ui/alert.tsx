// src/components/ui/alert.tsx
import * as React from "react"

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive"
}

export function Alert({
  children,
  variant = "default",
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={`rounded-lg border p-4 ${
        variant === "destructive" 
          ? "border-red-500/50 bg-red-50 text-red-700" 
          : "border-gray-200 bg-gray-50"
      }`}
      {...props}
    >
      {children}
    </div>
  )
}

export function AlertDescription({
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className="text-sm [&:not(:first-child)]:mt-2" {...props} />
}