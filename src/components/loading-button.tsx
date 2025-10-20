import type React from "react";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface LoadingButtonProps {
  loading: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "destructive";
  className?: string;
}

export function LoadingButton({
  loading,
  onClick,
  children,
  variant = "default",
  className = "",
}: LoadingButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={loading}
      variant={variant}
      className={className}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
