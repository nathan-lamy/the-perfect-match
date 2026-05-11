import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";

import "./styles.css";
import { StoreProvider } from "./lib/store";

// Access the queryClient that was passed into the router
const queryClient = router.options.context.queryClient;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StoreProvider>
  </StrictMode>,
);
