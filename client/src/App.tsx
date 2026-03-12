import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
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
import NewCampaign from "./pages/NewCampaign";
import NotFound from "./pages/not-found";

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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AppRoutes />
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
