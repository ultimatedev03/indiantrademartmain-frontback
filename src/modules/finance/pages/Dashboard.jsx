import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { IndianRupee } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const number = (v) => Number(v || 0);

const FinanceDashboard = () => {
  const [summary, setSummary] = useState({ totalGross: 0, totalNet: 0, last30: 0 });
  const [payments, setPayments] = useState([]);

  const load = async () => {
    try {
      const [s, p] = await Promise.all([fetch('/api/finance/summary'), fetch('/api/finance/payments')]);
      const sj = await s.json();
      const pj = await p.json();
      if (sj.success) setSummary(sj.data);
      if (pj.success) setPayments(pj.data || []);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to load finance data', variant: 'destructive' });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const exportCsv = () => {
    const header = ['vendor', 'plan', 'net', 'payment_date', 'coupon'];
    const rows = payments.map((p) =>
      [
        p.vendor?.company_name || p.vendor_id,
        p.plan?.name || p.plan_id,
        number(p.net_amount ?? p.amount),
        p.payment_date || '',
        p.coupon_code || '',
      ].join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finance-dashboard.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const cards = useMemo(
    () => [
      { title: 'Total Gross', value: summary.totalGross },
      { title: 'Total Net', value: summary.totalNet },
      { title: 'Last 30 days', value: summary.last30 },
    ],
    [summary]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Finance Dashboard</h1>
          <p className="text-sm text-neutral-500">Payments overview for finance team</p>
        </div>
        <Button variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader>
              <CardTitle>{c.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              {number(c.value).toLocaleString('en-IN')}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Payments</CardTitle>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Coupon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.vendor?.company_name || p.vendor_id}</TableCell>
                  <TableCell>{p.plan?.name || p.plan_id}</TableCell>
                  <TableCell>₹ {number(p.net_amount ?? p.amount).toLocaleString('en-IN')}</TableCell>
                  <TableCell>{p.payment_date ? format(new Date(p.payment_date), 'dd MMM yyyy') : '-'}</TableCell>
                  <TableCell>{p.coupon_code || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceDashboard;
