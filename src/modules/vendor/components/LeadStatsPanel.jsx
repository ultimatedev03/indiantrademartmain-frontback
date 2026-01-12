import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calendar, Users, Gift, ShoppingCart, DollarSign } from 'lucide-react';

const StatItem = ({ icon: Icon, label, value, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    pink: 'bg-pink-50 text-pink-600 border-pink-200',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        <Icon className="w-4 h-4 flex-shrink-0" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
};

const LeadStatsPanel = ({ stats, loading }) => {
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <Card className="border shadow-sm sticky top-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#003D82]" />
            Lead Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Time-based stats */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Purchased by Period</h4>
            
            <StatItem
              icon={Calendar}
              label="Today"
              value={stats.daily || 0}
              color="blue"
            />
            
            <StatItem
              icon={Calendar}
              label="This Week"
              value={stats.weekly || 0}
              color="green"
            />
            
            <StatItem
              icon={Calendar}
              label="This Year"
              value={stats.yearly || 0}
              color="purple"
            />
          </div>

          {/* Divider */}
          <div className="border-t my-3"></div>

          {/* Direct & Purchase stats */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Lead Sources</h4>
            
            <StatItem
              icon={Gift}
              label="Direct Leads"
              value={stats.direct || 0}
              color="orange"
            />
            
            <StatItem
              icon={ShoppingCart}
              label="Total Purchased"
              value={stats.totalPurchased || 0}
              color="cyan"
            />
          </div>

          {/* Divider */}
          <div className="border-t my-3"></div>

          {/* Amount stats */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Investment</h4>
            
            <div className="p-4 rounded-lg border bg-pink-50 text-pink-600 border-pink-200">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide">Total Spent</span>
                <DollarSign className="w-4 h-4 flex-shrink-0" />
              </div>
              <div className="text-2xl font-bold">₹{stats.totalAmount || 0}</div>
              <p className="text-xs mt-2 text-pink-500">
                Avg: ₹{stats.totalPurchased ? (stats.totalAmount / stats.totalPurchased).toFixed(0) : 0} per lead
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t my-3"></div>

          {/* Conversion stats */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Performance</h4>
            
            <div className="p-4 rounded-lg border bg-gray-50 text-gray-600 border-gray-200">
              <div className="text-sm font-medium mb-2">Conversion Rate</div>
              <div className="text-2xl font-bold text-[#003D82]">{stats.conversionRate}%</div>
              <p className="text-xs mt-2 text-gray-500">
                {stats.converted} converted from {stats.totalPurchased} leads
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadStatsPanel;
