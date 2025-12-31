
import React from 'react';
import StatsCard from '@/shared/components/StatsCard';
import { TrendingUp, Users, DollarSign } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="space-y-6">
       <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
       
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard title="New Leads" value="128" icon={Users} trend="+12% this week" />
          <StatsCard title="Conversions" value="15" icon={TrendingUp} className="text-green-600" />
          <StatsCard title="Revenue" value="₹1.2L" icon={DollarSign} />
       </div>

       <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="font-semibold mb-4">Sales Pipeline</h3>
          <div className="text-sm text-gray-500">Pipeline visualization placeholder.</div>
       </div>
    </div>
  );
};

export default Dashboard;
