
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Plus } from 'lucide-react';

const PricingRules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const { data, error } = await supabase
          .from('vendor_plans')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRules(data || []);
      } catch (error) {
        console.error('Failed to fetch pricing rules:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  const handleSubmitForApproval = (id) => {
    setRules(rules.map(r => r.id === id ? { ...r, status: 'PENDING_APPROVAL' } : r));
    toast({ title: "Submitted", description: "Rule sent for manager approval." });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-neutral-800">Pricing Rules Engine</h2>
        <Button className="bg-[#003D82]"><Plus className="h-4 w-4 mr-2" /> New Rule</Button>
      </div>
      
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.type}</TableCell>
                <TableCell>{r.value}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs border ${
                    r.status === 'ACTIVE' ? 'bg-green-50 border-green-200 text-green-700' :
                    r.status === 'PENDING_APPROVAL' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                    'bg-gray-50 border-gray-200 text-gray-700'
                  }`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {r.status === 'DRAFT' && (
                    <Button size="sm" variant="outline" onClick={() => handleSubmitForApproval(r.id)}>
                      Submit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PricingRules;
