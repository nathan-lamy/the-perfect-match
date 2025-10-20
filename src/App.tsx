"use client";

import "./App.css";
import { useState } from "react";
import { LoginForm } from "@/components/login-form";
import { StepManager } from "@/components/step-manager";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <LoginForm onLogin={() => setIsAuthenticated(true)} />;
  }

  return <StepManager />;
}
