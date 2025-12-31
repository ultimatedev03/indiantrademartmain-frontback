import React, { useEffect, useState } from 'react';
import { adminApi } from '@/modules/admin/services/adminApi';
import StatsCard from '@/shared/components/StatsCard';
import { Users, ShoppingBag, DollarSign, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalUsers: 0, activeVendors: 0, totalOrders: 0, totalRevenue: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [dataEntryPerf, setDataEntryPerf] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCreator, setExpandedCreator] = useState(null);
  const [creatorVendors, setCreatorVendors] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const s = await adminApi.getStats();
        setStats(s);
        const o = await adminApi.getRecentOrders();
        setRecentOrders(o || []);
        const p = await adminApi.getDataEntryPerformance();
        setDataEntryPerf(p || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleExpandCreator = async (creatorId) => {
      if (expandedCreator === creatorId) {
          setExpandedCreator(null);
          return;
      }
      setExpandedCreator(creatorId);
      if (!creatorVendors[creatorId]) {
          const vendors = await adminApi.getVendorsByCreator(creatorId);
          setCreatorVendors(prev => ({ ...prev, [creatorId]: vendors }));
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold text-gray-900">Admin Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard title="Total Users" value={stats.totalUsers} icon={Users} trend="+5% this week" trendUp={true} />
        <StatsCard title="Active Vendors" value={stats.activeVendors} icon={ShoppingBag} trend="+12% this week" trendUp={true} />
        <StatsCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} trend="+8% this month" trendUp={true} />
        <StatsCard title="Total Orders" value={stats.totalOrders} icon={TrendingUp} trend="+3% today" trendUp={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Recent Lead Purchases</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p>Loading...</p> : (
              <div className="space-y-4">
                 {recentOrders.map(order => (
                   <div key={order.id} className="flex justify-between items-center border-b pb-2">
                      <div>
                         <p className="font-medium">{order.vendor?.company_name || 'Unknown Vendor'}</p>
                         <p className="text-sm text-gray-500">{new Date(order.purchase_date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                         <p className="font-bold text-green-600">₹{order.amount}</p>
                         <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{order.payment_status}</span>
                      </div>
                   </div>
                 ))}
                 {recentOrders.length === 0 && <p className="text-gray-500 text-center">No recent orders found.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
           <CardHeader><CardTitle>Data Entry Performance</CardTitle></CardHeader>
           <CardContent>
              <Table>
                 <TableHeader>
                    <TableRow>
                       <TableHead className="w-[30px]"></TableHead>
                       <TableHead>Name</TableHead>
                       <TableHead className="text-center">Vendors</TableHead>
                       <TableHead className="text-center">Products</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {dataEntryPerf.map(emp => (
                       <React.Fragment key={emp.id}>
                          <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => handleExpandCreator(emp.id)}>
                             <TableCell>
                                {expandedCreator === emp.id ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                             </TableCell>
                             <TableCell className="font-medium">{emp.name}</TableCell>
                             <TableCell className="text-center font-bold text-blue-600">{emp.vendorsCreated}</TableCell>
                             <TableCell className="text-center">{emp.productsListed}</TableCell>
                          </TableRow>
                          {expandedCreator === emp.id && (
                             <TableRow className="bg-slate-50">
                                <TableCell></TableCell>
                                <TableCell colSpan={3}>
                                   <div className="p-2 max-h-60 overflow-auto">
                                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Created Vendors</h4>
                                      {creatorVendors[emp.id] ? (
                                         <div className="space-y-2">
                                            {creatorVendors[emp.id].map(v => (
                                               <div key={v.id} className="flex justify-between text-sm border-b pb-1">
                                                  <span>{v.company_name}</span>
                                                  <span className="text-gray-500">{v.products?.length || 0} products</span>
                                               </div>
                                            ))}
                                            {creatorVendors[emp.id].length === 0 && <p className="text-xs text-gray-400">No vendors created yet.</p>}
                                         </div>
                                      ) : <p className="text-xs">Loading...</p>}
                                   </div>
                                </TableCell>
                             </TableRow>
                          )}
                       </React.Fragment>
                    ))}
                 </TableBody>
              </Table>
           </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;