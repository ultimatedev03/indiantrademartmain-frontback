
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const { data, error } = await supabase
          .from('support_tickets')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        setTickets(data || []);
      } catch (error) {
        console.error('Failed to fetch tickets:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-neutral-800">All Tickets</h2>
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">Loading tickets...</TableCell>
              </TableRow>
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4 text-gray-500">No tickets found</TableCell>
              </TableRow>
            ) : (
              tickets.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.id?.substring(0, 8)}...</TableCell>
                  <TableCell className="max-w-xs truncate">{t.subject || 'N/A'}</TableCell>
                  <TableCell>{t.description?.substring(0, 20) || 'N/A'}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-bold ${(t.priority === 'HIGH' || t.priority === 'High') ? 'text-red-600' : 'text-gray-600'}`}>
                      {t.priority || 'NORMAL'}
                    </span>
                  </TableCell>
                  <TableCell>{t.status || 'UNKNOWN'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline">View</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Tickets;
