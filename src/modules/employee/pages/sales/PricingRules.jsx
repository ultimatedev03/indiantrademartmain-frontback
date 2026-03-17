import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Plus } from 'lucide-react';
import { salesApi } from '@/modules/employee/services/salesApi';

const LOCAL_RULES_STORAGE_KEY = 'itm_sales_pricing_rule_drafts';

const getRuleStatus = (rule) => {
  if (rule?.status) return String(rule.status).toUpperCase();
  if (rule?.is_active === true) return 'ACTIVE';
  if (rule?.is_active === false) return 'INACTIVE';
  return 'DRAFT';
};

const getRuleName = (rule) =>
  rule?.rule_name ||
  rule?.name ||
  rule?.plan_name ||
  'Untitled Rule';

const getRuleType = (rule) =>
  rule?.type ||
  rule?.plan_type ||
  rule?.billing_cycle ||
  '-';

const getRuleValue = (rule) => {
  const numeric = Number(rule?.value ?? rule?.price ?? rule?.amount);
  if (Number.isFinite(numeric)) {
    return `Rs ${numeric.toLocaleString('en-IN')}`;
  }
  return rule?.value ?? rule?.price ?? '-';
};

const readLocalRules = () => {
  try {
    const raw = window.localStorage.getItem(LOCAL_RULES_STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalRules = (rules = []) => {
  try {
    window.localStorage.setItem(LOCAL_RULES_STORAGE_KEY, JSON.stringify(rules || []));
  } catch {
    // ignore storage errors
  }
};

const createDefaultNewRule = () => ({ name: '', type: 'Manual', value: '' });

const PricingRules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRule, setNewRule] = useState(createDefaultNewRule);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const data = await salesApi.getPricingRules();
        setRules([...(readLocalRules() || []), ...(data || [])]);
      } catch (error) {
        console.error('Failed to fetch pricing rules:', error);
        toast({
          title: 'Pricing rules load failed',
          description: error?.message || 'Unable to load pricing rules',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  const handleSubmitForApproval = (id) => {
    setRules((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, status: 'PENDING_APPROVAL' } : r));
      writeLocalRules(next.filter((rule) => String(rule?.id || '').startsWith('draft-')));
      return next;
    });
    toast({ title: 'Submitted', description: 'Rule sent for manager approval.' });
  };

  const handleCreateRule = () => {
    const name = String(newRule.name || '').trim();
    const value = Number(newRule.value);

    if (!name) {
      toast({
        title: 'Rule name required',
        description: 'Please enter a rule name.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(value) || value < 0) {
      toast({
        title: 'Invalid rule value',
        description: 'Please enter a valid non-negative value.',
        variant: 'destructive',
      });
      return;
    }

    const draftRule = {
      id: `draft-${Date.now()}`,
      rule_name: name,
      type: newRule.type || 'Manual',
      value,
      status: 'DRAFT',
      is_active: false,
      created_at: new Date().toISOString(),
    };

    setRules((prev) => {
      const next = [draftRule, ...prev];
      writeLocalRules(next.filter((rule) => String(rule?.id || '').startsWith('draft-')));
      return next;
    });
    setNewRule(createDefaultNewRule());
    setCreateOpen(false);
    toast({
      title: 'Draft rule created',
      description: 'New pricing rule draft added to the list.',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-neutral-800">Pricing Rules Engine</h2>
        <Button
          type="button"
          className="bg-[#003D82]"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Rule
        </Button>
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-neutral-500">
                  Loading pricing rules...
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-neutral-500">
                  No pricing rules found.
                </TableCell>
              </TableRow>
            ) : (
              rules.map((r) => {
                const status = getRuleStatus(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{getRuleName(r)}</TableCell>
                    <TableCell>{getRuleType(r)}</TableCell>
                    <TableCell>{getRuleValue(r)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs border ${
                        status === 'ACTIVE' ? 'bg-green-50 border-green-200 text-green-700' :
                        status === 'PENDING_APPROVAL' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                        'bg-gray-50 border-gray-200 text-gray-700'
                      }`}>
                        {status.replaceAll('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {status === 'DRAFT' && (
                        <Button size="sm" variant="outline" onClick={() => handleSubmitForApproval(r.id)}>
                          Submit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNewRule(createDefaultNewRule());
          }
        }}
      >
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateRule();
            }}
          >
            <DialogHeader>
              <DialogTitle>Create Pricing Rule</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">Rule Name</label>
              <Input
                autoFocus
                value={newRule.name}
                onChange={(event) => setNewRule((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. North Region Premium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">Rule Type</label>
              <Input
                value={newRule.type}
                onChange={(event) => setNewRule((prev) => ({ ...prev, type: event.target.value }))}
                placeholder="e.g. Manual / Discount / Markup"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">Value</label>
              <Input
                type="number"
                value={newRule.value}
                onChange={(event) => setNewRule((prev) => ({ ...prev, value: event.target.value }))}
                placeholder="0"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setNewRule(createDefaultNewRule());
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[#003D82]">
                Create Draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingRules;
