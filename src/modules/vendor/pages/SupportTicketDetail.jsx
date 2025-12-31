
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send, ArrowLeft, User, Paperclip } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const SupportTicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadTicket();
  }, [id]);

  const loadTicket = async () => {
    try {
      const data = await vendorApi.support.getTicketDetail(id);
      setTicket(data);
    } catch (error) {
      toast({ title: "Error loading ticket", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await vendorApi.support.sendMessage(id, reply);
      setReply('');
      loadTicket(); // Refresh messages
    } catch (error) {
      toast({ title: "Failed to send reply", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!ticket) return <div className="p-8 text-center">Ticket not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <Button variant="ghost" onClick={() => navigate('/vendor/support')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tickets
      </Button>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{ticket.subject}</h1>
          <p className="text-sm text-gray-500 mt-1">
            ID: #{ticket.ticket_display_id || ticket.id.slice(0,8)} • {new Date(ticket.created_at).toLocaleString()}
          </p>
        </div>
        <Badge variant={ticket.status === 'OPEN' ? 'warning' : 'secondary'}>{ticket.status}</Badge>
      </div>

      <Card>
        <CardHeader className="bg-gray-50 border-b">
          <CardTitle className="text-sm font-medium text-gray-500">Description</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-800 whitespace-pre-wrap">{ticket.description}</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Conversation</h3>
        {ticket.messages.length === 0 ? (
          <p className="text-gray-500 italic">No messages yet.</p>
        ) : (
          ticket.messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.sender_type === 'VENDOR' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender_type === 'VENDOR' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                <User className="h-4 w-4" />
              </div>
              <div className={`max-w-[80%] rounded-lg p-4 ${msg.sender_type === 'VENDOR' ? 'bg-blue-50 border border-blue-100' : 'bg-white border border-gray-200'}`}>
                <div className="flex justify-between items-center mb-2 gap-4">
                  <span className="font-semibold text-xs">{msg.sender_type}</span>
                  <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {ticket.status !== 'CLOSED' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 md:pl-72">
          <div className="max-w-4xl mx-auto flex gap-4">
            <Textarea 
              value={reply} 
              onChange={e => setReply(e.target.value)} 
              placeholder="Type your reply..." 
              className="min-h-[60px]"
            />
            <Button className="h-auto bg-[#003D82]" onClick={handleReply} disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportTicketDetail;
