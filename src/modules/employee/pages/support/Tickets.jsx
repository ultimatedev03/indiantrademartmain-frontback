import React, { useEffect, useState } from 'react';
import { supportApi } from '@/modules/employee/services/supportApi';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search, Eye, MessageSquare, Send, Loader2, Filter,
  User, Building2, Calendar
} from 'lucide-react';

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, searchTerm]);

  const fetchTickets = async () => {
    try {
      setLoading(true);

      const filters = {
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
        search: searchTerm || undefined
      };

      const data = await supportApi.getAllTickets(filters);
      setTickets(data || []);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      toast({ title: "Error", description: "Failed to load tickets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openTicketDetails = async (ticket) => {
    setSelectedTicket(ticket);
    setDetailsOpen(true);
    setNewMessage("");

    try {
      const msgs = await supportApi.getMessages(ticket.id);
      setTicketMessages(msgs || []);
    } catch (e) {
      console.error(e);
      setTicketMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    setSendingMessage(true);
    const messageText = newMessage.trim();

    try {
      await supportApi.sendMessage(selectedTicket.id, messageText);
      setNewMessage('');
      toast({ title: "Message sent" });

      // ✅ reload from API so reopen pe bhi same dikhe
      const msgs = await supportApi.getMessages(selectedTicket.id);
      setTicketMessages(msgs || []);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({ title: "Error", description: error.message || "Failed to send message", variant: "destructive" });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedTicket) return;

    setUpdatingStatus(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      const response = await fetchWithCsrf(`${API_URL}/api/support/tickets/${selectedTicket.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update status');

      setSelectedTicket({ ...result.ticket });
      setTickets(tickets.map(t => (t.id === selectedTicket.id ? result.ticket : t)));

      toast({ title: "Status updated", description: `Ticket marked as ${newStatus}` });
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status) => {
    const upper = String(status || 'OPEN').toUpperCase();
    const styles = {
      'OPEN': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'IN_PROGRESS': 'bg-blue-100 text-blue-800 border-blue-200',
      'CLOSED': 'bg-green-100 text-green-800 border-green-200',
      'RESOLVED': 'bg-green-100 text-green-800 border-green-200'
    };
    return styles[upper] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority) => {
    const upper = String(priority || 'MEDIUM').toUpperCase();
    const styles = {
      'HIGH': 'bg-red-100 text-red-800 border-red-200',
      'MEDIUM': 'bg-orange-100 text-orange-800 border-orange-200',
      'LOW': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return styles[upper] || 'bg-gray-100 text-gray-800';
  };

  const filteredTickets = tickets.filter(ticket => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      ticket.subject?.toLowerCase().includes(s) ||
      ticket.description?.toLowerCase().includes(s) ||
      ticket.ticket_display_id?.toLowerCase().includes(s);

    const ticketStatus = String(ticket.status || '').toUpperCase();
    const ticketPriority = String(ticket.priority || '').toUpperCase();

    const matchesStatus = statusFilter === 'ALL' || ticketStatus === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || ticketPriority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800">Support Tickets</h2>
          <p className="text-gray-500">Manage and respond to customer support requests</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {filteredTickets.length} Tickets
        </Badge>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tickets..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priority</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="animate-spin mx-auto h-6 w-6 text-gray-400" />
                </TableCell>
              </TableRow>
            ) : filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map(ticket => (
                <TableRow key={ticket.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm truncate max-w-[260px]">
                        {ticket.subject || 'No Subject'}
                      </p>
                      <p className="text-xs text-gray-500 truncate max-w-[260px]">
                        {ticket.description?.substring(0, 60)}...
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${getPriorityBadge(ticket.priority)}`}>
                      {String(ticket.priority || 'MEDIUM').toUpperCase()}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${getStatusBadge(ticket.status)}`}>
                      {String(ticket.status || 'OPEN').toUpperCase()}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-sm text-gray-500">
                    {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '—'}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openTicketDetails(ticket)}>
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Ticket Details
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedTicket.subject}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(selectedTicket.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className={getPriorityBadge(selectedTicket.priority)}>
                      {String(selectedTicket.priority || 'MEDIUM').toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={getStatusBadge(selectedTicket.status)}>
                      {String(selectedTicket.status || 'OPEN').toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-sm font-medium text-gray-700">Description:</p>
                  <p className="text-sm text-gray-600 mt-1">{selectedTicket.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium">Update Status:</span>
                <Select value={selectedTicket.status} onValueChange={handleUpdateStatus} disabled={updatingStatus}>
                  <SelectTrigger className="w-[150px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
                {updatingStatus && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>

              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Conversation
                </h4>

                <div className="space-y-3 max-h-[220px] overflow-y-auto p-2 bg-gray-50 rounded-lg">
                  {ticketMessages.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm py-4">No messages yet</p>
                  ) : (
                    ticketMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg text-sm ${
                          String(msg.sender_type || '').toUpperCase() === 'SUPPORT'
                            ? 'bg-blue-100 ml-8'
                            : 'bg-white border mr-8'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-xs">
                            {String(msg.sender_type || '').toUpperCase() === 'SUPPORT' ? 'Support Team' : 'Customer'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                        <p>{msg.message}</p>
                      </div>
                    ))
                  )}
                </div>

                {String(selectedTicket.status || '').toUpperCase() !== 'CLOSED' && (
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your reply..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 min-h-[80px]"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !newMessage.trim()}
                      className="bg-[#003D82]"
                    >
                      {sendingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tickets;
