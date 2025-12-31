
import React from 'react';
import StatsCard from '@/shared/components/StatsCard';
import { Users, Clock, CalendarCheck } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="space-y-6">
       <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
       
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard title="Total Employees" value="124" icon={Users} />
          <StatsCard title="Present Today" value="118" icon={CalendarCheck} className="text-green-600" />
          <StatsCard title="On Leave" value="6" icon={Clock} className="text-orange-600" />
       </div>

       <div className="p-10 border-2 border-dashed rounded-lg text-center text-gray-400">
          <p>Employee Attendance & Performance Charts Placeholder</p>
       </div>
    </div>
  );
};

export default Dashboard;
