/**
 * NotFoundPage Component (404 Fallback)
 * 
 * Production 404 Not Found fallback view rendered when an unknown route URL is requested.
 * Includes quick action buttons to return to the main Infrastructure Dashboard.
 * 
 * @module pages/NotFoundPage
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-6">
      <Card className="bg-card/70 border-border/70 p-10 max-w-md w-full shadow-2xl flex flex-col items-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">404 - Page Not Found</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The requested infrastructure page or route does not exist on this VPSGUI instance.
          </p>
        </div>

        <div className="pt-2 flex items-center space-x-3 w-full">
          <Button variant="outline" onClick={() => navigate(-1)} className="flex-1 text-xs gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Go Back</span>
          </Button>

          <Link to="/dashboard" className="flex-1">
            <Button className="w-full text-xs gap-1.5 bg-primary font-bold">
              <Home className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default NotFoundPage;
