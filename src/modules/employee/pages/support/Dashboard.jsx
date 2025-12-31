
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { MessageSquare, CheckCircle, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatsCard from '@/shared/components/StatsCard';

const Dashboard = () => {
  const [stats, setStats] = useState({ open: 0, resolved: 0, avgTime: 0 });
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get all tickets with proper error handling
      const { data: allTickets, error: ticketsError } = await supabase
        .from('support_tickets')
        .select('id, subject, status, priority, created_at, resolved_at, description, vendor_id, buyer_id')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (ticketsError) {
        console.error('Tickets fetch error:', ticketsError);
        throw ticketsError;
      }

      console.log('Loaded tickets from DB:', allTickets);

      if (!allTickets || allTickets.length === 0) {
        setStats({
          open: 0,
          resolved: 0,
          avgTime: '2h 15m'
        });
        setRecentTickets([]);
        setLoading(false);
        return;
      }

      // Calculate stats
      const openTickets = allTickets?.filter(t => 
        t.status && (t.status.toUpperCase() === 'OPEN' || t.status.toUpperCase() === 'IN_PROGRESS')
      ) || [];
      
      const resolvedToday = allTickets?.filter(t => {
        const status = t.status?.toUpperCase();
        const isResolved = status === 'CLOSED';
        if (!isResolved) return false;
        if (!t.resolved_at) return false;
        const ticketDate = new Date(t.resolved_at).toDateString();
        const today = new Date().toDateString();
        return ticketDate === today;
      }) || [];

      console.log('Open tickets:', openTickets.length);
      console.log('Resolved today:', resolvedToday.length);

      setStats({
        open: openTickets.length,
        resolved: resolvedToday.length,
        avgTime: '2h 15m'
      });

      // Get recent tickets
      setRecentTickets(allTickets?.slice(0, 5) || []);
    } catch (error) {
      console.error('Dashboard error:', error);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
      setStats({ open: 0, resolved: 0, avgTime: '2h 15m' });
      setRecentTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'OPEN': return 'secondary';
      case 'IN_PROGRESS': return 'warning';
      case 'RESOLVED': return 'default';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of support tickets and team performance</p>
      </div>
       
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          title="Open Tickets" 
          value={stats.open} 
          icon={MessageSquare} 
          className="text-red-600" 
        />
        <StatsCard 
          title="Resolved Today" 
          value={stats.resolved} 
          icon={CheckCircle} 
          className="text-green-600" 
        />
        <StatsCard 
          title="Avg Response Time" 
          value={stats.avgTime} 
          icon={Clock} 
          className="text-blue-600"
        />
      </div>

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Tickets</CardTitle>
            <Link to="/employee/support/tickets">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-gray-400" />
            </div>
          ) : recentTickets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No tickets found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTickets.map(ticket => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-sm">{ticket.id?.substring(0, 8)}...</TableCell>
                      <TableCell className="max-w-xs truncate">{ticket.subject}</TableCell>
                      <TableCell>
                        <Badge variant={ticket.priority === 'HIGH' ? 'destructive' : ticket.priority === 'MEDIUM' ? 'secondary' : 'outline'}>
                          {ticket.priority || 'NORMAL'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(ticket.status)}>
                          {ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/employee/support/tickets`}>
                          <Button size="sm" variant="ghost">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
