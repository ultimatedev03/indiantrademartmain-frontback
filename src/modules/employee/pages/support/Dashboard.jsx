import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { MessageSquare, CheckCircle, Clock, Loader2, AlertCircle, ArrowUpRight, TrendingUp, Users, Building2, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatsCard from '@/shared/components/StatsCard';

const Dashboard = () => {
  const [stats, setStats] = useState({ open: 0, resolved: 0, avgTime: 0, inProgress: 0, highPriority: 0 });
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching support tickets from API...');
      
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      // Fetch stats from API
      const statsResponse = await fetch(`${API_URL}/api/support/stats`);
      const statsData = await statsResponse.json();
      
      console.log('Stats from API:', statsData);
      
      // Fetch all tickets from API
      const ticketsResponse = await fetch(`${API_URL}/api/support/tickets?pageSize=100`);
      const ticketsData = await ticketsResponse.json();
      
      console.log('Tickets from API:', ticketsData);
      const allTickets = ticketsData.tickets || [];
      
      if (!allTickets || allTickets.length === 0) {
        setStats({
          open: 0,
          inProgress: 0,
          highPriority: 0,
          resolved: 0,
          avgTime: '2h 15m'
        });
        setRecentTickets([]);
        setLoading(false);
        return;
      }

      setStats({
        open: statsData.stats?.openTickets || 0,
        inProgress: statsData.stats?.inProgressTickets || 0,
        highPriority: statsData.stats?.highPriorityTickets || 0,
        resolved: statsData.stats?.resolvedTickets || 0,
        avgTime: '2h 15m'
      });

      // Show recent tickets (latest first)
      setRecentTickets(allTickets || []);
    } catch (error) {
      console.error('Dashboard error:', error);
      // Fallback to Supabase if API fails
      try {
        const { data: allTickets } = await supabase
          .from('support_tickets')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (allTickets && allTickets.length > 0) {
          const openTickets = allTickets.filter(t => t.status?.toUpperCase() === 'OPEN');
          const inProgressTickets = allTickets.filter(t => t.status?.toUpperCase() === 'IN_PROGRESS');
          const highPriorityTickets = allTickets.filter(t => 
            (t.priority?.toUpperCase() === 'HIGH' || t.priority?.toUpperCase() === 'URGENT') && 
            t.status?.toUpperCase() !== 'CLOSED'
          );
          
          setStats({
            open: openTickets.length,
            inProgress: inProgressTickets.length,
            highPriority: highPriorityTickets.length,
            resolved: 0,
            avgTime: '2h 15m'
          });
          setRecentTickets(allTickets);
        }
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
        setStats({ open: 0, inProgress: 0, highPriority: 0, resolved: 0, avgTime: '2h 15m' });
        setRecentTickets([]);
      }
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of support tickets and team performance</p>
        </div>
        <Link to="/employee/support/tickets">
          <Button className="bg-[#003D82]">
            <MessageSquare className="h-4 w-4 mr-2" /> View All Tickets
          </Button>
        </Link>
      </div>
       
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Open</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.open}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">High Priority</p>
                <p className="text-2xl font-bold text-red-600">{stats.highPriority}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Resolved Today</p>
                <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Avg Response</p>
                <p className="text-2xl font-bold text-purple-600">{stats.avgTime}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Tickets</CardTitle>
            <Link to="/employee/support/tickets">
              <Button variant="ghost" size="sm" className="text-[#003D82]">
                View All <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
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
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No tickets found</p>
              <p className="text-sm">New support tickets will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTickets.map(ticket => (
                <div key={ticket.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-full ${
                      ticket.vendor_id ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      {ticket.vendor_id ? (
                        <Building2 className="h-4 w-4 text-blue-600" />
                      ) : (
                        <User className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(ticket.created_at).toLocaleDateString()} • ID: {ticket.id?.substring(0, 8)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        ticket.priority === 'HIGH' 
                          ? 'bg-red-100 text-red-800 border-red-200' 
                          : ticket.priority === 'MEDIUM'
                          ? 'bg-orange-100 text-orange-800 border-orange-200'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {ticket.priority || 'MEDIUM'}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        ticket.status === 'OPEN' 
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-200' 
                          : ticket.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : 'bg-green-100 text-green-800 border-green-200'
                      }`}
                    >
                      {ticket.status}
                    </Badge>
                    <Link to="/employee/support/tickets">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
