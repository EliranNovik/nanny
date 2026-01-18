import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, Clock, DollarSign, Edit, Trash2, Search, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SimpleCalendar } from "@/components/SimpleCalendar";

interface Payment {
  id: string;
  job_id: string;
  freelancer_id: string;
  client_id: string;
  currency_id: string | null;
  hours_worked: number;
  hourly_rate: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  status: "pending" | "accepted" | "declined" | "paid" | "cancelled";
  created_at: string;
  paid_at: string | null;
  currency?: {
    id: string;
    name: string;
    iso: string;
    icon: string;
  } | null;
  job?: {
    id: string;
    children_count: number;
    children_age_group: string;
    location_city: string;
    start_at: string | null;
    created_at: string;
    updated_at: string;
    stage?: string;
  };
  other_party?: {
    full_name: string | null;
    photo_url: string | null;
  };
}

export default function PaymentsPage() {
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [paidPayments, setPaidPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editHours, setEditHours] = useState<string>("");
  const [editCurrencyId, setEditCurrencyId] = useState<string>("");
  const [currencies, setCurrencies] = useState<Array<{ id: string; name: string; iso: string; icon: string }>>([]);
  const [editPending, setEditPending] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilterType, setDateFilterType] = useState<"created" | "job_ended" | "job_requested" | "">("");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);
  const [filteredPendingPayments, setFilteredPendingPayments] = useState<Payment[]>([]);
  const [filteredPaidPayments, setFilteredPaidPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    loadPayments();
    loadCurrencies();
  }, [user, profile]);

  async function loadCurrencies() {
    try {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .order("name");
      
      if (error) {
        console.error("Error fetching currencies:", error);
      } else if (data) {
        setCurrencies(data);
      }
    } catch (err) {
      console.error("Error loading currencies:", err);
    }
  }

  function openEditModal(payment: Payment) {
    setEditingPayment(payment);
    setEditHours(payment.hours_worked.toString());
    setEditCurrencyId(payment.currency_id || "");
    setShowEditModal(true);
  }

  function closeEditModal() {
    setEditingPayment(null);
    setEditHours("");
    setEditCurrencyId("");
    setShowEditModal(false);
  }

  async function handleEditPayment() {
    if (!editingPayment || !user || editPending) return;

    // Validate currency
    if (!editCurrencyId) {
      addToast({
        title: "Currency required",
        description: "Please select a currency.",
        variant: "error",
      });
      return;
    }

    // Validate hours
    const hours = parseFloat(editHours) || 0;
    if (isNaN(hours) || hours <= 0) {
      addToast({
        title: "Invalid hours",
        description: "Please enter a valid number of hours.",
        variant: "error",
      });
      return;
    }

    setEditPending(true);
    try {
      // Calculate new amounts
      const rate = editingPayment.hourly_rate;
      const vatRate = 0.18;
      const subtotal = hours * rate;
      const vat = subtotal * vatRate;
      const total = subtotal + vat;

      // Update payment
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          hours_worked: hours,
          currency_id: editCurrencyId,
          subtotal: subtotal,
          vat_amount: vat,
          total_amount: total,
        })
        .eq("id", editingPayment.id);

      if (updateError) throw updateError;

      // Reload payments
      await loadPayments();
      
      closeEditModal();
      addToast({
        title: "Payment updated",
        description: "The payment has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating payment:", error);
      addToast({
        title: "Error",
        description: "Failed to update payment. Please try again.",
        variant: "error",
      });
    } finally {
      setEditPending(false);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!user || deletingPayment) return;

    if (!confirm("Are you sure you want to delete this payment? You can create a new one after deletion.")) {
      return;
    }

    setDeletingPayment(paymentId);
    try {
      const { error: deleteError } = await supabase
        .from("payments")
        .delete()
        .eq("id", paymentId);

      if (deleteError) throw deleteError;

      // Reload payments
      await loadPayments();
      
      addToast({
        title: "Payment deleted",
        description: "The payment has been deleted. You can create a new payment request.",
      });
    } catch (error) {
      console.error("Error deleting payment:", error);
      addToast({
        title: "Error",
        description: "Failed to delete payment. Please try again.",
        variant: "error",
      });
    } finally {
      setDeletingPayment(null);
    }
  }

  async function loadPayments() {
    if (!user || !profile) return;

    try {
      let paymentsQuery;
      
      if (profile.role === "client") {
        // Clients see payments for their jobs
        paymentsQuery = supabase
          .from("payments")
          .select(`
            *,
            currency:currencies(id, name, iso, icon),
            job:job_requests(id, children_count, children_age_group, location_city, start_at, created_at, updated_at, stage),
            freelancer:profiles!payments_freelancer_id_fkey(id, full_name, photo_url)
          `)
          .eq("client_id", user.id)
          .order("created_at", { ascending: false });
      } else {
        // Freelancers see payments for their work
        paymentsQuery = supabase
          .from("payments")
          .select(`
            *,
            currency:currencies(id, name, iso, icon),
            job:job_requests(id, children_count, children_age_group, location_city, start_at, created_at, updated_at, stage),
            client:profiles!payments_client_id_fkey(id, full_name, photo_url)
          `)
          .eq("freelancer_id", user.id)
          .order("created_at", { ascending: false });
      }

      const { data: payments, error } = await paymentsQuery;

      if (error) {
        console.error("Error loading payments:", error);
        return;
      }

      if (payments) {
        // Map the relationship data to other_party
        const mappedPayments = payments.map((p: any) => ({
          ...p,
          other_party: profile.role === "client" ? p.freelancer : p.client
        }));
        
        // Pending includes both "pending" and "accepted" statuses (accepted but not yet paid)
        const pending = mappedPayments.filter((p: Payment) => 
          p.status === "pending" || p.status === "accepted"
        );
        const paid = mappedPayments.filter((p: Payment) => p.status === "paid");
        
        setPendingPayments(pending);
        setPaidPayments(paid);
        // Initialize filtered payments with all payments
        setFilteredPendingPayments(pending);
        setFilteredPaidPayments(paid);
      }

    } catch (err) {
      console.error("Error loading payments:", err);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters(pending: Payment[], paid: Payment[]) {
    let filteredPending = [...pending];
    let filteredPaid = [...paid];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredPending = filteredPending.filter((payment) => {
        const clientName = payment.other_party?.full_name?.toLowerCase() || "";
        const place = payment.job?.location_city?.toLowerCase() || "";
        return clientName.includes(query) || place.includes(query);
      });
      filteredPaid = filteredPaid.filter((payment) => {
        const clientName = payment.other_party?.full_name?.toLowerCase() || "";
        const place = payment.job?.location_city?.toLowerCase() || "";
        return clientName.includes(query) || place.includes(query);
      });
    }

    // Apply date filter
    if (dateFilterType && (dateFrom || dateTo)) {
      filteredPending = filteredPending.filter((payment) => {
        return matchesDateFilter(payment, dateFilterType, dateFrom, dateTo);
      });
      filteredPaid = filteredPaid.filter((payment) => {
        return matchesDateFilter(payment, dateFilterType, dateFrom, dateTo);
      });
    }

    setFilteredPendingPayments(filteredPending);
    setFilteredPaidPayments(filteredPaid);
  }

  function matchesDateFilter(
    payment: Payment,
    filterType: "created" | "job_ended" | "job_requested",
    from: Date | null,
    to: Date | null
  ): boolean {
    let dateToCheck: Date | null = null;

    switch (filterType) {
      case "created":
        dateToCheck = payment.created_at ? new Date(payment.created_at) : null;
        break;
      case "job_ended":
        // Use job.updated_at when stage is "Job Ended" or later as proxy for job end date
        if (payment.job?.updated_at && payment.job?.stage && 
            (payment.job.stage === "Job Ended" || payment.job.stage === "Payment" || payment.job.stage === "Completed")) {
          dateToCheck = new Date(payment.job.updated_at);
        }
        break;
      case "job_requested":
        dateToCheck = payment.job?.created_at ? new Date(payment.job.created_at) : null;
        break;
    }

    if (!dateToCheck) return false;

    // Check if date is within range
    const dateOnly = new Date(dateToCheck.getFullYear(), dateToCheck.getMonth(), dateToCheck.getDate());
    const fromDate = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()) : null;
    const toDate = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate()) : null;

    if (fromDate && dateOnly < fromDate) return false;
    if (toDate && dateOnly > toDate) return false;

    return true;
  }

  function clearFilters() {
    setSearchQuery("");
    setDateFilterType("");
    setDateFrom(null);
    setDateTo(null);
    setShowDateFromPicker(false);
    setShowDateToPicker(false);
  }

  useEffect(() => {
    applyFilters(pendingPayments, paidPayments);
  }, [searchQuery, dateFilterType, dateFrom, dateTo, pendingPayments, paidPayments]);

  function formatJobTitle(job: Payment["job"]): string {
    if (!job) return "Job";
    return `Nanny – ${job.children_count} kid${job.children_count > 1 ? "s" : ""} (${job.children_age_group})`;
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-mesh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-24">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Payments</h1>
          <p className="text-muted-foreground">
            {profile?.role === "client" 
              ? "Track payments for your jobs"
              : "View your payment requests and history"}
          </p>
        </div>

        {/* Search and Filter Section */}
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by client name or place..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {/* Filter Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Date Filter Type */}
                  <div>
                    <Label htmlFor="date-filter-type" className="text-xs">Filter By Date</Label>
                    <Select value={dateFilterType} onValueChange={(value) => setDateFilterType(value as any)}>
                      <SelectTrigger id="date-filter-type" className="mt-1">
                        <SelectValue placeholder="Select date type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created">Payment Created</SelectItem>
                        <SelectItem value="job_ended">Job Ended</SelectItem>
                        <SelectItem value="job_requested">Job Requested</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters Button */}
                  {(dateFilterType || dateFrom || dateTo || searchQuery) && (
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        className="w-full"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </div>

                {/* Date Range Pickers */}
                {dateFilterType && (
                  <div className="grid grid-cols-2 gap-3">
                    {/* From Date */}
                    <div>
                      <Label className="text-xs">From Date</Label>
                      <Dialog open={showDateFromPicker} onOpenChange={setShowDateFromPicker}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full mt-1 justify-start text-left font-normal"
                          >
                            {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Select date"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Select From Date</DialogTitle>
                          </DialogHeader>
                          <SimpleCalendar
                            selectedDate={dateFrom}
                            onDateSelect={(date) => {
                              setDateFrom(date);
                              setShowDateFromPicker(false);
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* To Date */}
                    <div>
                      <Label className="text-xs">To Date</Label>
                      <Dialog open={showDateToPicker} onOpenChange={setShowDateToPicker}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full mt-1 justify-start text-left font-normal"
                          >
                            {dateTo ? format(dateTo, "MMM d, yyyy") : "Select date"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Select To Date</DialogTitle>
                          </DialogHeader>
                          <SimpleCalendar
                            selectedDate={dateTo}
                            onDateSelect={(date) => {
                              setDateTo(date);
                              setShowDateToPicker(false);
                            }}
                            minDate={dateFrom || undefined}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">
              Pending
              {filteredPendingPayments.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {filteredPendingPayments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="paid">
              Paid
              {filteredPaidPayments.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {filteredPaidPayments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-6">
            {filteredPendingPayments.length === 0 ? (
              <Card className="border-0 shadow-lg text-center py-12">
                <CardContent>
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">
                    {pendingPayments.length === 0 
                      ? "No Pending Payments"
                      : "No Payments Match Filters"}
                  </h3>
                  <p className="text-muted-foreground">
                    {pendingPayments.length === 0
                      ? (profile?.role === "client"
                          ? "You don't have any pending payments to review."
                          : "You don't have any pending payment requests.")
                      : "Try adjusting your search or filter criteria."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredPendingPayments.map((payment) => (
                <Card key={payment.id} className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">
                          {formatJobTitle(payment.job)}
                        </CardTitle>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className={cn(
                            payment.status === "accepted" 
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                          )}>
                            <Clock className="w-3 h-3 mr-1" />
                            {payment.status === "accepted" ? "Accepted" : "Pending"}
                          </Badge>
                          {payment.job?.location_city && (
                            <span className="text-sm text-muted-foreground">
                              {payment.job.location_city}
                            </span>
                          )}
                        </div>
                        {payment.other_party && (
                          <p className="text-sm text-muted-foreground">
                            {profile?.role === "client" ? "Freelancer: " : "Client: "}
                            {payment.other_party.full_name || "Unknown"}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Hours:</span>
                        <span className="font-medium">{payment.hours_worked}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Hourly Rate:</span>
                        <span className="font-medium">
                          {payment.currency?.icon || "$"}{payment.hourly_rate.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="font-medium">
                          {payment.currency?.icon || "$"}{payment.subtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VAT ({payment.vat_rate}%):</span>
                        <span className="font-medium">
                          {payment.currency?.icon || "$"}{payment.vat_amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between text-base font-semibold">
                          <span>Total:</span>
                          <span className="text-primary">
                            {payment.currency?.icon || "$"}{payment.total_amount.toFixed(2)} {payment.currency?.iso || ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      Created: {format(new Date(payment.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                    <div className="flex gap-2">
                      {payment.status === "accepted" && profile?.role === "client" && (
                        <Button
                          onClick={async () => {
                            if (!user || !payment.id) return;
                            setMarkingPaid(payment.id);
                            
                            try {
                              // Update payment status to paid
                              const { error: paymentError } = await supabase
                                .from("payments")
                                .update({
                                  status: "paid",
                                  paid_at: new Date().toISOString()
                                })
                                .eq("id", payment.id);
                              
                              if (paymentError) throw paymentError;

                              // Update job stage to Completed
                              if (payment.job_id) {
                                const { error: jobError } = await supabase
                                  .from("job_requests")
                                  .update({
                                    stage: "Completed",
                                    status: "completed"
                                  })
                                  .eq("id", payment.job_id);
                                
                                if (jobError) console.error("Error updating job:", jobError);
                              }

                              // Reload payments
                              await loadPayments();
                              
                              addToast({
                                title: "Payment completed",
                                description: "The payment has been marked as paid.",
                              });
                            } catch (error) {
                              console.error("Error completing payment:", error);
                              addToast({
                                title: "Error",
                                description: "Failed to complete payment. Please try again.",
                                variant: "error",
                              });
                            } finally {
                              setMarkingPaid(null);
                            }
                          }}
                          disabled={markingPaid === payment.id}
                          className="flex-1"
                          size="sm"
                        >
                          {markingPaid === payment.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            "Mark as Paid"
                          )}
                        </Button>
                      )}
                      {payment.status === "pending" && profile?.role === "freelancer" && (
                        <>
                          <Button
                            onClick={() => openEditModal(payment)}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDeletePayment(payment.id)}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={deletingPayment === payment.id}
                          >
                            {deletingPayment === payment.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="paid" className="space-y-4 mt-6">
            {filteredPaidPayments.length === 0 ? (
              <Card className="border-0 shadow-lg text-center py-12">
                <CardContent>
                  <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">
                    {paidPayments.length === 0 
                      ? "No Payment History"
                      : "No Payments Match Filters"}
                  </h3>
                  <p className="text-muted-foreground">
                    {paidPayments.length === 0
                      ? "Your completed payments will appear here."
                      : "Try adjusting your search or filter criteria."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary Card */}
                <Card className="border-0 shadow-lg bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {profile?.role === "client" ? "Total Paid" : "Total Earned"}
                        </p>
                        <p className="text-2xl font-bold">
                          {/* Group by currency and show totals */}
                          {Object.entries(
                            filteredPaidPayments.reduce((acc, p) => {
                              const currencyKey = p.currency?.iso || "USD";
                              if (!acc[currencyKey]) {
                                acc[currencyKey] = { total: 0, icon: p.currency?.icon || "$" };
                              }
                              acc[currencyKey].total += p.total_amount;
                              return acc;
                            }, {} as Record<string, { total: number; icon: string }>)
                          ).map(([iso, { total, icon }]) => (
                            <span key={iso} className="mr-2">
                              {icon}{total.toFixed(2)} {iso}
                            </span>
                          ))}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>

                {filteredPaidPayments.map((payment) => (
                  <Card key={payment.id} className="border-0 shadow-lg">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-2">
                            {formatJobTitle(payment.job)}
                          </CardTitle>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Paid
                            </Badge>
                            {payment.job?.location_city && (
                              <span className="text-sm text-muted-foreground">
                                {payment.job.location_city}
                              </span>
                            )}
                          </div>
                          {payment.other_party && (
                            <p className="text-sm text-muted-foreground">
                              {profile?.role === "client" ? "Freelancer: " : "Client: "}
                              {payment.other_party.full_name || "Unknown"}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Hours:</span>
                          <span className="font-medium">{payment.hours_worked}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Hourly Rate:</span>
                          <span className="font-medium">
                            {payment.currency?.icon || "$"}{payment.hourly_rate.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">
                            {payment.currency?.icon || "$"}{payment.subtotal.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">VAT ({payment.vat_rate}%):</span>
                          <span className="font-medium">
                            {payment.currency?.icon || "$"}{payment.vat_amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between text-base font-semibold">
                            <span>Total:</span>
                            <span className="text-primary">
                              {payment.currency?.icon || "$"}{payment.total_amount.toFixed(2)} {payment.currency?.iso || ""}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>
                          Created: {format(new Date(payment.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                        {payment.paid_at && (
                          <div>
                            Paid: {format(new Date(payment.paid_at), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Payment Modal */}
        <Dialog open={showEditModal} onOpenChange={closeEditModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Payment Request</DialogTitle>
              <DialogDescription>
                Update payment hours and currency
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-currency-select">Currency</Label>
                <Select value={editCurrencyId} onValueChange={setEditCurrencyId}>
                  <SelectTrigger id="edit-currency-select" className="mt-2">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.id} value={currency.id}>
                        {currency.icon} {currency.name} ({currency.iso})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="edit-hours-input">Hours Worked</Label>
                <Input
                  id="edit-hours-input"
                  type="number"
                  step="0.5"
                  min="0.5"
                  placeholder="e.g., 4.5"
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                  className="mt-2"
                />
              </div>

              {editingPayment && editHours && parseFloat(editHours) > 0 && editCurrencyId && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Hourly Rate:</span>
                    <span className="font-medium">
                      {currencies.find(c => c.id === editCurrencyId)?.icon || "$"}
                      {editingPayment.hourly_rate.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Hours:</span>
                    <span className="font-medium">{parseFloat(editHours) || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">
                      {currencies.find(c => c.id === editCurrencyId)?.icon || "$"}
                      {(parseFloat(editHours) * editingPayment.hourly_rate).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT (18%):</span>
                    <span className="font-medium">
                      {currencies.find(c => c.id === editCurrencyId)?.icon || "$"}
                      {(parseFloat(editHours) * editingPayment.hourly_rate * 0.18).toFixed(2)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total:</span>
                    <span>
                      {currencies.find(c => c.id === editCurrencyId)?.icon || "$"}
                      {(parseFloat(editHours) * editingPayment.hourly_rate * 1.18).toFixed(2)} {currencies.find(c => c.id === editCurrencyId)?.iso || ""}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={closeEditModal}
                  disabled={editPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleEditPayment}
                  disabled={editPending || !editHours || parseFloat(editHours) <= 0 || !editCurrencyId}
                >
                  {editPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Payment"
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
