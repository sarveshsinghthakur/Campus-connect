import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "@/components/ThemeToggle";

type AppRole = Database["public"]["Enums"]["app_role"];

const Auth = () => {
  const navigate = useNavigate();
  const { user, role: currentRole, loading: authLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("student");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (user && currentRole) {
      navigate(currentRole === "professor" ? "/professor" : "/student");
    }
  }, [authLoading, currentRole, navigate, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });

        if (error) throw error;

        if (data.user) {
          const userId = data.user.id;
          const { error: profileError } = await supabase.from("profiles").insert({ user_id: userId, name });
          if (profileError) throw profileError;

          const { error: roleError } = await supabase.from("user_roles").insert({ user_id: userId, role });
          if (roleError) throw roleError;

          toast({ title: "Account created", description: "You are now signed in." });
          navigate(role === "professor" ? "/professor" : "/student");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        toast({ title: "Welcome back" });
        navigate("/");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{isSignUp ? "Create Account" : "Sign In"}</CardTitle>
          <CardDescription>
            {isSignUp ? "Sign up to book appointments and post blogs" : "Sign in to manage appointments and community blogs"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
              />
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label>I am a</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={role === "student" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setRole("student")}
                  >
                    Student
                  </Button>
                  <Button
                    type="button"
                    variant={role === "professor" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setRole("professor")}
                  >
                    Professor
                  </Button>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button className="text-primary underline" onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
