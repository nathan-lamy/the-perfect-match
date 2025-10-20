"use client";

import "./App.css";
import { useEffect, useState } from "react";
import { LoginForm } from "@/components/login-form";
import { StepManager } from "@/components/step-manager";

import { invoke } from "@tauri-apps/api/core";
import { saveSession } from "./lib/utils";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  async function checkAuth() {
    const session = await invoke<string>("load_session").catch(() => null);
    if (session) {
      saveSession(session);
      setIsAuthenticated(true);
    }
  }
  useEffect(() => {
    checkAuth();
  }, []);

  if (!isAuthenticated) {
    return <LoginForm onLogin={() => setIsAuthenticated(true)} />;
  }

  return <StepManager />;
}
