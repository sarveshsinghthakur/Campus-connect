import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, Clock, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CommunityBlog from "@/components/CommunityBlog";
import ThemeToggle from "@/components/ThemeToggle";

interface Professor {
  user_id: string;
  name: string;
}

interface Slot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  professor_id: string;
}

interface Appointment {
  id: string;
  status: string;
  availability_id: string;
  availability: Slot;
  professor_name: string;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, role, profileName, signOut, loading: authLoading } = useAuth();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bookedSlotIds, setBookedSlotIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/auth");
      return;
    }

    if (role === "professor") {
      navigate("/professor");
    }
  }, [authLoading, navigate, role, user]);

  const fetchProfessors = async () => {
    if (!user) return;

    const { data: roleData } = await supabase.from("user_roles").select("user_id").eq("role", "professor");

    if (roleData && roleData.length > 0) {
      const profIds = roleData.map((row) => row.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", profIds);
      setProfessors(profiles || []);
      return;
    }

    setProfessors([]);
  };

  const fetchSlots = async (professorId: string) => {
    const { data: slots } = await supabase
      .from("availability")
      .select("*")
      .eq("professor_id", professorId)
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date")
      .order("start_time");

    if (slots && slots.length > 0) {
      const slotIds = slots.map((slot) => slot.id);
      const { data: myBookedRows } = await supabase
        .from("appointments")
        .select("availability_id")
        .in("availability_id", slotIds)
        .eq("status", "booked");

      setBookedSlotIds(new Set(myBookedRows?.map((row) => row.availability_id) || []));
    } else {
      setBookedSlotIds(new Set());
    }

    setAvailableSlots(slots || []);
  };

  const fetchAppointments = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("appointments")
      .select("*, availability(*)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      setAppointments([]);
      return;
    }

    const professorIds = [
      ...new Set((data as any[]).map((row) => (row.availability as Slot)?.professor_id).filter(Boolean)),
    ];

    const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", professorIds);
    const profileMap = new Map(profiles?.map((profile) => [profile.user_id, profile.name]) || []);

    setAppointments(
      data.map((row) => ({
        ...row,
        availability: row.availability as unknown as Slot,
        professor_name: profileMap.get((row.availability as unknown as Slot)?.professor_id) || "Professor",
      })),
    );
  };

  useEffect(() => {
    if (!user || role !== "student") return;

    fetchProfessors();
    fetchAppointments();
  }, [role, user]);

  useEffect(() => {
    if (selectedProfessor) {
      fetchSlots(selectedProfessor.user_id);
    }
  }, [selectedProfessor]);

  const bookSlot = async (slotId: string) => {
    if (!user) return;

    setLoading(true);
    const { error } = await supabase.from("appointments").insert({
      student_id: user.id,
      availability_id: slotId,
    });
    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Appointment booked" });

    if (selectedProfessor) {
      fetchSlots(selectedProfessor.user_id);
    }

    fetchAppointments();
  };

  if (authLoading || !user || role !== "student") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Student Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome, {profileName || "Student"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <Tabs defaultValue="browse">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="browse">Browse Professors</TabsTrigger>
            <TabsTrigger value="appointments">My Appointments</TabsTrigger>
            <TabsTrigger value="blog">Community Blog</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            {selectedProfessor ? (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedProfessor(null)}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to Professors
                </Button>
                <h2 className="text-lg font-semibold">{selectedProfessor.name}'s Available Slots</h2>
                {availableSlots.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">No available slots.</p>
                )}
                {availableSlots.map((slot) => {
                  const isBooked = bookedSlotIds.has(slot.id);

                  return (
                    <Card key={slot.id}>
                      <CardContent className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-4">
                          <CalendarDays className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{format(new Date(`${slot.date}T00:00:00`), "MMM d, yyyy")}</span>
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </span>
                        </div>
                        <Button size="sm" disabled={isBooked || loading} onClick={() => bookSlot(slot.id)}>
                          {isBooked ? "Booked" : "Book"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {professors.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">No professors registered yet.</p>
                )}
                {professors.map((professor) => (
                  <Card
                    key={professor.user_id}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() => setSelectedProfessor(professor)}
                  >
                    <CardContent className="flex items-center gap-3 py-4">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{professor.name}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="appointments" className="space-y-2">
            {appointments.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No appointments yet.</p>
            )}
            {appointments.map((appointment) => (
              <Card key={appointment.id}>
                <CardContent className="py-4">
                  <p className="font-medium">{appointment.professor_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {appointment.availability &&
                      format(new Date(`${appointment.availability.date}T00:00:00`), "MMM d, yyyy")} |{" "}
                    {appointment.availability?.start_time?.slice(0, 5)} - {appointment.availability?.end_time?.slice(0, 5)}
                  </p>
                  <span
                    className={`text-xs font-medium ${
                      appointment.status === "booked" ? "text-green-600" : "text-destructive"
                    }`}
                  >
                    {appointment.status.toUpperCase()}
                  </span>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="blog" className="space-y-4">
            <CommunityBlog />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default StudentDashboard;
