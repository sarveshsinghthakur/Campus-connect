import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, CalendarDays, GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";

const Index = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && role) {
      navigate(role === "professor" ? "/professor" : "/student");
    }
  }, [loading, navigate, role, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">Campus Connect</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/auth">
              <Button>Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-2xl space-y-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Book Appointments with Professors</h1>
          <p className="text-lg text-muted-foreground">
            Campus Connect helps students book professor appointments and gives every logged-in user a shared blog
            and comments space.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <div className="flex items-center gap-2 rounded-lg border bg-card p-4">
              <GraduationCap className="h-8 w-8 text-primary" />
              <div className="text-left">
                <p className="font-semibold">Students</p>
                <p className="text-sm text-muted-foreground">Browse and book slots</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-card p-4">
              <BookOpen className="h-8 w-8 text-primary" />
              <div className="text-left">
                <p className="font-semibold">Professors</p>
                <p className="text-sm text-muted-foreground">Manage availability</p>
              </div>
            </div>
          </div>
          <Link to="/auth">
            <Button size="lg" className="mt-4">Get Started</Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Index;
