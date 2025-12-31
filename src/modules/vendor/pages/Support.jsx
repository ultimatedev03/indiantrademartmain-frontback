
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/components/ui/use-toast';

const Support = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', category: '', description: '', priority: 'Medium' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const data = await vendorApi.support.getTickets();
      setTickets(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTicket.subject || !newTicket.description || !newTicket.category) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await vendorApi.support.createTicket(newTicket);
      setOpen(false);
      setNewTicket({ subject: '', category: '', description: '', priority: 'Medium' });
      loadTickets();
      toast({ title: "Ticket Created" });
    } catch (error) {
      toast({ title: "Error creating ticket", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#003D82]">
              <PlusCircle className="mr-2 h-4 w-4" /> New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={newTicket.subject} onChange={e => setNewTicket({...newTicket, subject: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select onValueChange={v => setNewTicket({...newTicket, category: v})}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technical">Technical Issue</SelectItem>
                    <SelectItem value="Billing">Billing & Payments</SelectItem>
                    <SelectItem value="Account">Account Management</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500">Priority will be set by our support team based on urgency.</p>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} />
              </div>
              <Button className="w-full bg-[#003D82]" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null} Submit Ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-gray-400" /></div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No tickets found.</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {tickets.map(ticket => (
              <Link key={ticket.id} to={`/vendor/support/${ticket.id}`} className="block hover:bg-neutral-50 p-4 transition-colors">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-neutral-900">{ticket.subject}</h3>
                      <p className="text-xs text-neutral-500">ID: #{ticket.ticket_display_id || ticket.id.slice(0,8)} • {new Date(ticket.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={ticket.status === 'OPEN' ? 'warning' : ticket.status === 'CLOSED' ? 'secondary' : 'default'}>
                      {ticket.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Support;
