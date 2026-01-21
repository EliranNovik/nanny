import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getJobStageBadge } from "@/lib/jobStages";

interface JobRequest {
  id: string;
  status: string;
  stage: string | null;
  care_type: string;
  children_count: number;
  children_age_group: string;
  location_city: string;
  start_at: string | null;
  selected_freelancer_id: string | null;
  client_id: string;
  created_at: string;
}

interface BookedJob extends JobRequest {
  otherPartyName: string | null;
  otherPartyPhoto: string | null;
}

export default function CalendarPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  // Try to load cached data immediately
  const getCachedCalendarData = () => {
    try {
      const cached = localStorage.getItem(`calendar_${user?.id}_${profile?.role}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 30000) {
          return parsed.data;
        }
      }
    } catch (e) {}
    return null;
  };

  const cachedData = (user && profile) ? getCachedCalendarData() : null;
  const [loading, setLoading] = useState(!cachedData);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookedJobs, setBookedJobs] = useState<BookedJob[]>(cachedData?.bookedJobs || []);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<BookedJob[]>([]);
  const [unavailableTimeSlots, setUnavailableTimeSlots] = useState<Array<{id: string, date: string, start_time: string, end_time: string}>>([]);
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [selectedDateForSlot, setSelectedDateForSlot] = useState<Date | null>(null);
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("17:00");
  const [addingSlot, setAddingSlot] = useState(false);

  // Load unavailable time slots for freelancers
  useEffect(() => {
    async function loadUnavailableTimeSlots() {
      if (!user || !profile || profile.role !== "freelancer") {
        return;
      }

      try {
        const { data, error } = await supabase
          .from("freelancer_unavailable_dates")
          .select("id, unavailable_date, start_time, end_time")
          .eq("freelancer_id", user.id)
          .order("unavailable_date", { ascending: true })
          .order("start_time", { ascending: true });

        if (error) {
          console.error("Error loading unavailable time slots:", error);
          return;
        }

        if (data) {
          setUnavailableTimeSlots(data.map(item => ({
            id: item.id,
            date: item.unavailable_date,
            start_time: item.start_time,
            end_time: item.end_time
          })));
        }
      } catch (err) {
        console.error("Error loading unavailable time slots:", err);
      }
    }

    loadUnavailableTimeSlots();
  }, [user, profile]);

  useEffect(() => {
    async function loadBookedJobs() {
      if (!user || !profile) {
        setLoading(false);
        return;
      }

      try {
        let jobsQuery;
        
        if (profile.role === "client") {
          // For clients: get jobs where they are the client and job is booked (locked/active)
          jobsQuery = supabase
            .from("job_requests")
            .select("*")
            .eq("client_id", user.id)
            .in("status", ["locked", "active"])
            .not("start_at", "is", null);
        } else {
          // For freelancers: get jobs where they are selected and job is booked
          jobsQuery = supabase
            .from("job_requests")
            .select("*")
            .eq("selected_freelancer_id", user.id)
            .in("status", ["locked", "active"])
            .not("start_at", "is", null);
        }

        const { data: jobs, error } = await jobsQuery;

        if (error) {
          console.error("Error loading booked jobs:", error);
          setLoading(false);
          return;
        }

        if (!jobs || jobs.length === 0) {
          setBookedJobs([]);
          setLoading(false);
          return;
        }

        // Fetch other party profiles (freelancer for client, client for freelancer)
        const otherPartyIds = profile.role === "client"
          ? jobs.map(j => j.selected_freelancer_id).filter(Boolean) as string[]
          : jobs.map(j => j.client_id).filter(Boolean) as string[];

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", otherPartyIds);

        const profilesMap = new Map(
          (profiles || []).map(p => [p.id, p])
        );

        const enrichedJobs: BookedJob[] = jobs.map(job => {
          const otherPartyId = profile.role === "client" 
            ? job.selected_freelancer_id 
            : job.client_id;
          const otherParty = otherPartyId ? profilesMap.get(otherPartyId) : null;
          
          return {
            ...job,
            otherPartyName: otherParty?.full_name || null,
            otherPartyPhoto: otherParty?.photo_url || null,
          };
        });

        setBookedJobs(enrichedJobs);

        // Cache the data for instant loading next time
        if (user && profile) {
          try {
            localStorage.setItem(`calendar_${user.id}_${profile.role}`, JSON.stringify({
              timestamp: Date.now(),
              data: {
                bookedJobs: enrichedJobs
              }
            }));
          } catch (e) {
            // Ignore cache errors
          }
        }
      } catch (err) {
        console.error("Error loading booked jobs:", err);
      } finally {
        setLoading(false);
      }
    }

    loadBookedJobs();
  }, [user, profile]);

  // Update cache whenever booked jobs change (from real-time updates or initial load)
  useEffect(() => {
    if (user && profile && bookedJobs.length >= 0) {
      try {
        localStorage.setItem(`calendar_${user.id}_${profile.role}`, JSON.stringify({
          timestamp: Date.now(),
          data: {
            bookedJobs
          }
        }));
      } catch (e) {
        // Ignore cache errors
      }
    }
  }, [bookedJobs, user, profile]);

  // Update selected jobs when date changes
  useEffect(() => {
    if (!selectedDate) {
      setSelectedJobs([]);
      return;
    }

    const jobsOnDate = bookedJobs.filter(job => {
      if (!job.start_at) return false;
      const jobDate = new Date(job.start_at);
      return (
        jobDate.getDate() === selectedDate.getDate() &&
        jobDate.getMonth() === selectedDate.getMonth() &&
        jobDate.getFullYear() === selectedDate.getFullYear()
      );
    });

    setSelectedJobs(jobsOnDate);
  }, [selectedDate, bookedJobs]);

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const today = new Date();
  const isToday = (date: Date) => {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const hasJobOnDate = (date: Date) => {
    return bookedJobs.some(job => {
      if (!job.start_at) return false;
      const jobDate = new Date(job.start_at);
      return (
        jobDate.getDate() === date.getDate() &&
        jobDate.getMonth() === date.getMonth() &&
        jobDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const isDateUnavailable = (date: Date) => {
    if (!unavailableTimeSlots || unavailableTimeSlots.length === 0) return false;
    const dateStr = date.toISOString().split('T')[0];
    return unavailableTimeSlots.some(slot => slot.date === dateStr);
  };

  const getUnavailableSlotsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return unavailableTimeSlots.filter(slot => slot.date === dateStr);
  };

  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const handleDateClick = async (day: number) => {
    const date = new Date(year, month, day);
    setSelectedDate(date);
    
    // For freelancers, also allow opening modal to add time slots
    if (profile?.role === "freelancer") {
      // Could add double-click to open modal, but for now just select
    }
  };

  const handleAddTimeSlot = () => {
    if (!selectedDate) return;
    setSelectedDateForSlot(selectedDate);
    setNewStartTime("09:00");
    setNewEndTime("17:00");
    setShowTimeSlotModal(true);
  };

  const handleSaveTimeSlot = async () => {
    if (!user || !selectedDateForSlot || !newStartTime || !newEndTime) return;
    
    if (newEndTime <= newStartTime) {
      alert("End time must be after start time");
      return;
    }

    setAddingSlot(true);
    try {
      const dateStr = selectedDateForSlot.toISOString().split('T')[0];
      const { error } = await supabase
        .from("freelancer_unavailable_dates")
        .insert({
          freelancer_id: user.id,
          unavailable_date: dateStr,
          start_time: newStartTime,
          end_time: newEndTime
        });

      if (error) throw error;

      // Reload time slots
      const { data } = await supabase
        .from("freelancer_unavailable_dates")
        .select("id, unavailable_date, start_time, end_time")
        .eq("freelancer_id", user.id)
        .order("unavailable_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (data) {
        setUnavailableTimeSlots(data.map(item => ({
          id: item.id,
          date: item.unavailable_date,
          start_time: item.start_time,
          end_time: item.end_time
        })));
      }

      setShowTimeSlotModal(false);
    } catch (err) {
      console.error("Error adding time slot:", err);
      alert("Failed to add time slot. Please try again.");
    } finally {
      setAddingSlot(false);
    }
  };

  const handleDeleteTimeSlot = async (slotId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from("freelancer_unavailable_dates")
        .delete()
        .eq("id", slotId)
        .eq("freelancer_id", user.id);

      if (error) throw error;

      // Reload time slots
      const { data } = await supabase
        .from("freelancer_unavailable_dates")
        .select("id, unavailable_date, start_time, end_time")
        .eq("freelancer_id", user.id)
        .order("unavailable_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (data) {
        setUnavailableTimeSlots(data.map(item => ({
          id: item.id,
          date: item.unavailable_date,
          start_time: item.start_time,
          end_time: item.end_time
        })));
      }
    } catch (err) {
      console.error("Error deleting time slot:", err);
      alert("Failed to delete time slot. Please try again.");
    }
  };

  const formatJobTitle = (job: BookedJob): string => {
    return `Nanny – ${job.children_count} kid${job.children_count > 1 ? "s" : ""} (${formatAgeGroup(job.children_age_group)})`;
  };

  const formatAgeGroup = (group: string): string => {
    const map: Record<string, string> = {
      newborn: "0-3 months",
      infant: "3-12 months",
      toddler: "1-3 years",
      preschool: "3-5 years",
      mixed: "Mixed ages",
    };
    return map[group] || group;
  };

  const formatTime = (time: string): string => {
    // Remove seconds from time string (HH:MM:SS -> HH:MM)
    if (!time) return "";
    return time.split(':').slice(0, 2).join(':');
  };

  const getJobStatusBadge = (status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      locked: { label: "Scheduled", variant: "default" },
      active: { label: "In progress", variant: "default" },
    };
    return map[status] || { label: status, variant: "outline" };
  };

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-32 md:pb-24">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <CalendarIcon className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Calendar</h1>
          </div>
          {profile?.role === "freelancer" && (
            <div className="text-xs text-muted-foreground">
              Hover over a day and click the icon to mark as unavailable
            </div>
          )}
        </div>

        <Card className="border-0 shadow-xl mb-6">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousMonth}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg">
                {monthNames[month]} {year}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextMonth}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day Names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before month starts */}
              {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const date = new Date(year, month, day);
                const hasJob = hasJobOnDate(date);
                const unavailable = isDateUnavailable(date);
                const selected = isDateSelected(date);
                const isTodayDate = isToday(date);

                return (
                  <button
                    key={day}
                    onClick={() => handleDateClick(day)}
                    className={cn(
                      "aspect-square rounded-md text-sm font-medium transition-colors relative",
                      "hover:bg-accent hover:text-accent-foreground",
                      unavailable && "bg-destructive/20 text-destructive/70",
                      selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                      !selected && !unavailable && "hover:bg-muted",
                      isTodayDate && !selected && "ring-2 ring-primary/50"
                    )}
                    title={unavailable ? "Has unavailable time slots" : undefined}
                  >
                    {day}
                    {hasJob && !unavailable && (
                      <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                    {unavailable && (
                      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-destructive rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Jobs */}
        {selectedDate && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </CardTitle>
                {profile?.role === "freelancer" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddTimeSlot}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Unavailable Time
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Unavailable Time Slots for Freelancers */}
              {profile?.role === "freelancer" && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Unavailable Time Slots</h4>
                  {getUnavailableSlotsForDate(selectedDate).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No unavailable time slots</p>
                  ) : (
                    <div className="space-y-2">
                      {getUnavailableSlotsForDate(selectedDate).map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between p-2 rounded border bg-destructive/5"
                        >
                          <span className="text-sm">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTimeSlot(slot.id)}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selectedJobs.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No jobs scheduled for this date
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedJobs.map((job) => {
                    const statusBadge = getJobStatusBadge(job.status);
                    const jobDate = job.start_at ? new Date(job.start_at) : null;
                    
                    return (
                      <div
                        key={job.id}
                        className="p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          // Navigate to chat if conversation exists, otherwise to active jobs
                          navigate(`/client/active-jobs`);
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm mb-1">
                              {formatJobTitle(job)}
                            </h3>
                            {job.otherPartyName && (
                              <p className="text-sm text-muted-foreground">
                                {profile?.role === "client" ? "With: " : "Client: "}
                                {job.otherPartyName}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={statusBadge.variant} className="text-xs">
                              {statusBadge.label}
                            </Badge>
                            {job.stage && (
                              <Badge variant={getJobStageBadge(job.stage).variant} className="text-xs">
                                {getJobStageBadge(job.stage).label}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <span>{job.location_city}</span>
                          {jobDate && (
                            <span>
                              {jobDate.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {bookedJobs.length === 0 && (
          <Card className="border-0 shadow-lg text-center py-12">
            <CardContent>
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <CalendarIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Booked Jobs</h3>
              <p className="text-muted-foreground">
                {profile?.role === "client"
                  ? "Your scheduled jobs will appear here."
                  : "Your booked jobs will appear here once clients confirm you."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Add Time Slot Modal */}
        <Dialog open={showTimeSlotModal} onOpenChange={setShowTimeSlotModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Unavailable Time Slot</DialogTitle>
              <DialogDescription>
                Select a time range when you will be unavailable on{" "}
                {selectedDateForSlot?.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowTimeSlotModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTimeSlot}
                  disabled={addingSlot || !newStartTime || !newEndTime || newEndTime <= newStartTime}
                >
                  {addingSlot ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Time Slot"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

