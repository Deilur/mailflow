import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Newsletters from "./pages/Newsletters";
import NewsletterDetail from "./pages/NewsletterDetail";
import Campaigns from "./pages/Campaigns";
import CampaignEditor from "./pages/CampaignEditor";
import Funnels from "./pages/Funnels";
import FunnelDetail from "./pages/FunnelDetail";
import FunnelBuilder from "./pages/FunnelBuilder";
import Subscribers from "./pages/Subscribers";
import SuperSubscribers from "./pages/SuperSubscribers";
import Templates from "./pages/Templates";
import NewCampaign from "./pages/NewCampaign";
import NotFound from "./pages/not-found";
import Login from "./pages/Login";

// Auth context so Layout can access logout
interface AuthContextValue {
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue>({ logout: async () => {} });
export function useAuth() {
  return useContext(AuthContext);
}

function AppRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/newsletters" component={Newsletters} />
        <Route path="/newsletters/:id" component={NewsletterDetail} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/campaigns/new" component={NewCampaign} />
        <Route path="/campaigns/:id/edit" component={CampaignEditor} />
        <Route path="/funnels" component={Funnels} />
        <Route path="/funnels/new" component={FunnelBuilder} />
        <Route path="/funnels/:id/edit" component={FunnelBuilder} />
        <Route path="/funnels/:id" component={FunnelDetail} />
        <Route path="/subscribers" component={Subscribers} />
        <Route path="/super-subscribers" component={SuperSubscribers} />
        <Route path="/templates" component={Templates} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        setAuthState("authenticated");
      } else {
        setAuthState("unauthenticated");
      }
    } catch {
      setAuthState("unauthenticated");
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthState("unauthenticated");
    queryClient.clear();
  }, []);

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Cargando...</div>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <QueryClientProvider client={queryClient}>
        <Login onLogin={() => setAuthState("authenticated")} />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ logout }}>
        <Router hook={useHashLocation}>
          <AppRoutes />
        </Router>
        <Toaster />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
