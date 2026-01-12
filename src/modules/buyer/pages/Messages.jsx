
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Card } from '@/shared/components/Card';
import { Loader2, MessageSquare, Send, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Fetch Conversations (Proposals that have messages)
  useEffect(() => {
    if (user) fetchConversations();
  }, [user]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const { data: buyer } = await supabase.from('buyers').select('id').eq('user_id', user.id).single();
      if (!buyer) return;

      // Fetch proposals linked to buyer
      const { data: proposals } = await supabase
        .from('proposals')
        .select(`
          id, title, status, created_at,
          vendors (id, company_name, profile_completion)
        `)
        .eq('buyer_id', buyer.id)
        .order('created_at', { ascending: false });

      setConversations(proposals || []);
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Messages for Selected Chat
  useEffect(() => {
    if (!selectedChat) return;

    const fetchMessages = async () => {
       const { data } = await supabase
         .from('proposal_messages')
         .select('*')
         .eq('proposal_id', selectedChat.id)
         .order('created_at', { ascending: true });
       setMessages(data || []);
    };

    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`chat:${selectedChat.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'proposal_messages', 
        filter: `proposal_id=eq.${selectedChat.id}` 
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);

  }, [selectedChat]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    try {
      await supabase.from('proposal_messages').insert([{
        proposal_id: selectedChat.id,
        sender_id: user.id, // Auth user ID
        message: newMessage
      }]);
      setNewMessage('');
    } catch (error) {
      console.error("Failed to send:", error);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex gap-6">
      {/* Sidebar List */}
      <Card className="w-1/3 flex flex-col overflow-hidden border-gray-200">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-bold text-gray-800">Conversations</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
             <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : conversations.length === 0 ? (
             <div className="p-6 text-center text-gray-500">No active proposals</div>
          ) : (
             conversations.map(chat => (
               <div 
                 key={chat.id} 
                 onClick={() => setSelectedChat(chat)}
                 className={`p-4 border-b cursor-pointer hover:bg-blue-50 transition-colors ${selectedChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-l-[#003D82]' : ''}`}
               >
                 <div className="flex justify-between mb-1">
                    <span className="font-semibold text-gray-900 text-sm truncate">{chat.vendors?.company_name || 'Vendor'}</span>
                    <span className="text-[10px] text-gray-400">{new Date(chat.created_at).toLocaleDateString()}</span>
                 </div>
                 <p className="text-xs text-gray-500 truncate">{chat.title}</p>
               </div>
             ))
          )}
        </div>
      </Card>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden border-gray-200 shadow-sm">
        {selectedChat ? (
          <>
            <div className="p-4 border-b bg-white flex justify-between items-center shadow-sm z-10">
              <div>
                <h3 className="font-bold text-gray-900">{selectedChat.vendors?.company_name}</h3>
                <p className="text-xs text-gray-500">Re: {selectedChat.title}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 mt-10">Start the conversation...</div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_id === user.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-xl text-sm ${
                        isMe ? 'bg-[#003D82] text-white rounded-tr-none' : 'bg-white border text-gray-800 rounded-tl-none'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-white border-t flex gap-2">
              <Input 
                value={newMessage} 
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..." 
                className="flex-1"
              />
              <Button onClick={handleSend} size="icon" className="bg-[#003D82]">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
             <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
             <p>Select a conversation to view messages</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Messages;
