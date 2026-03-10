import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarDays, Clock, LogOut, Trash2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CommunityBlog from "@/components/CommunityBlog";
import ThemeToggle from "@/components/ThemeToggle";

interface Slot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
}

interface Appointment {
  id: string;
  status: string;
  created_at: string;
  availability_id: string;
  student_id: string;
  availability: Slot;
  student_profile: { name: string } | null;
}

const ProfessorDashboard = () => {
  const navigate = useNavigate();
  const { user, role, profileName, signOut, loading: authLoading } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/auth");
      return;
    }

    if (role === "student") {
      navigate("/student");
    }
  }, [authLoading, navigate, role, user]);

  const fetchData = async () => {
    if (!user) return;

    const [{ data: slotsData }, { data: appointmentRows }] = await Promise.all([
      supabase.from("availability").select("*").eq("professor_id", user.id).order("date").order("start_time"),
      supabase.from("appointments").select("*, availability(*)").order("created_at", { ascending: false }),
    ]);

    setSlots(slotsData || []);

    if (appointmentRows && appointmentRows.length > 0) {
      const studentIds = [...new Set(appointmentRows.map((row) => row.student_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", studentIds);
      const profileMap = new Map(profiles?.map((profile) => [profile.user_id, profile]) || []);

      setAppointments(
        appointmentRows.map((row) => ({
          ...row,
          availability: row.availability as unknown as Slot,
          student_profile: profileMap.get(row.student_id)
            ? { name: profileMap.get(row.student_id)!.name }
            : null,
        })),
      );
    } else {
      setAppointments([]);
    }
  };

  useEffect(() => {
    if (!user || role !== "professor") return;
    fetchData();
  }, [role, user]);

  const addSlot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setLoading(true);
    const { error } = await supabase.from("availability").insert({
      professor_id: user.id,
      date,
      start_time: startTime,
      end_time: endTime,
    });
    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Slot added" });
    setDate("");
    setStartTime("");
    setEndTime("");
    fetchData();
  };

  const deleteSlot = async (slotId: string) => {
    const { error } = await supabase.from("availability").delete().eq("id", slotId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Slot removed" });
    fetchData();
  };

  const cancelAppointment = async (appointmentId: string) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Appointment cancelled" });
    fetchData();
  };

  if (authLoading || !user || role !== "professor") {
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
          <h1 className="text-xl font-semibold">Professor Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome, {profileName || "Professor"}</p>
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
        <Tabs defaultValue="availability">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="availability">My Availability</TabsTrigger>
            <TabsTrigger value="appointments">My Appointments</TabsTrigger>
            <TabsTrigger value="blog">Community Blog</TabsTrigger>
          </TabsList>

          <TabsContent value="availability" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Time Slot</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={addSlot} className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="start">Start Time</Label>
                    <Input
                      id="start"
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      required
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="end">End Time</Label>
                    <Input id="end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={loading}>Add Slot</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {slots.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">No availability slots yet.</p>
              )}
              {slots.map((slot) => (
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
                    <Button variant="ghost" size="icon" onClick={() => deleteSlot(slot.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="appointments" className="space-y-2">
            {appointments.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No appointments yet.</p>
            )}
            {appointments.map((appointment) => (
              <Card key={appointment.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{appointment.student_profile?.name || "Student"}</p>
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
                  </div>
                  {appointment.status === "booked" && (
                    <Button variant="outline" size="sm" onClick={() => cancelAppointment(appointment.id)}>
                      <XCircle className="mr-1 h-4 w-4" />
                      Cancel
                    </Button>
                  )}
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

export default ProfessorDashboard;
