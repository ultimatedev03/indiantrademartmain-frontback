
import React, { useState, useEffect } from 'react';
import { useSuperAdmin } from '@/modules/admin/context/SuperAdminContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { auditLogService } from '@/services/auditLogService';
import { 
  ShieldAlert, Settings, Users, Activity, LogOut, 
  ToggleLeft, ToggleRight, AlertTriangle, Save, RefreshCw,
  Lock, Trash2, Edit, Search, Plus, X, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Allowed roles that SUPERADMIN can create (IMPORTANT: Cannot create SUPERADMIN)
const ALLOWED_ROLES = ['ADMIN', 'HR', 'DATA_ENTRY', 'SALES', 'SUPPORT'];

const SuperAdminDashboard = () => {
  const { superAdmin, logout, changePassword } = useSuperAdmin();
  const [activeTab, setActiveTab] = useState('pages');
  
  // --- PAGE CONTROL STATE ---
  const [pages, setPages] = useState([]);
  const [pageLoading, setPageLoading] = useState(false);
  
  // --- AUDIT LOG STATE ---
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // --- USER MANAGEMENT STATE ---
  const [users, setUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    full_name: '', email: '', password: '', role: 'USER', status: 'ACTIVE'
  });

  // --- SETTINGS STATE ---
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  useEffect(() => {
    fetchPages();
    fetchUsers();
    fetchAuditLogs();
  }, []);

  // ================= PAGE CONTROL FUNCTIONS =================

  const fetchPages = async () => {
    setPageLoading(true);
    const { data, error } = await supabase.from('page_status').select('*').order('page_name');
    if (error) toast({ title: "Error", description: "Failed to fetch pages", variant: "destructive" });
    else setPages(data || []);
    setPageLoading(false);
  };

  const updatePageStatus = async (pageId, isBlanked, errorMessage) => {
    // Optimistic UI update
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, is_blanked: isBlanked } : p));

    const { error } = await supabase
      .from('page_status')
      .update({ 
        is_blanked: isBlanked,
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', pageId);

    if (error) {
      toast({ title: "Error", description: "Failed to update page status", variant: "destructive" });
      fetchPages(); // Revert on error
    } else {
      // Log the action to audit logs
      await auditLogService.logAction(
        superAdmin.id,
        isBlanked ? 'PAGE_BLANKED' : 'PAGE_RESTORED',
        'PAGE',
        pageId,
        { isBlanked, errorMessage }
      );
      
      toast({ 
        title: isBlanked ? "Page Offline" : "Page Online", 
        description: "Status updated successfully." 
      });
      
      // Refresh audit logs
      fetchAuditLogs();
    }
  };

  const handlePageMessageChange = async (pageId, newMessage) => {
    const { error } = await supabase
      .from('page_status')
      .update({ error_message: newMessage, updated_at: new Date().toISOString() })
      .eq('id', pageId);
      
    if (!error) toast({ title: "Saved", description: "Error message updated." });
  };

  // ================= AUDIT LOG FUNCTIONS =================

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    const logs = await auditLogService.getAuditLogs(50, 24);
    setAuditLogs(logs);
    setAuditLoading(false);
  };

  // ================= USER MANAGEMENT FUNCTIONS =================

  const fetchUsers = async () => {
    setUserLoading(true);
    let query = supabase.from('users').select('*').order('created_at', { ascending: false });
    
    if (roleFilter !== 'ALL') query = query.eq('role', roleFilter);
    
    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: "Failed to fetch users", variant: "destructive" });
    } else {
      // Client-side search for simplicity in this demo
      const filtered = data.filter(u => 
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setUsers(filtered);
    }
    setUserLoading(false);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setUserLoading(true);

    try {
      // Validate role - SUPERADMIN can only create specific roles
      if (!ALLOWED_ROLES.includes(userForm.role)) {
        toast({ 
          title: "Invalid Role", 
          description: `You can only create users with these roles: ${ALLOWED_ROLES.join(', ')}`, 
          variant: "destructive" 
        });
        setUserLoading(false);
        return;
      }

      if (editingUser) {
        // Update - cannot change existing user's role if it's SUPERADMIN
        if (editingUser.role === 'SUPERADMIN' && userForm.role !== 'SUPERADMIN') {
          toast({ 
            title: "Permission Denied", 
            description: "Cannot modify SUPERADMIN user roles", 
            variant: "destructive" 
          });
          setUserLoading(false);
          return;
        }

        const { error } = await supabase
          .from('users')
          .update({
            full_name: userForm.full_name,
            email: userForm.email,
            role: userForm.role,
            status: userForm.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingUser.id);
        
        if (error) throw error;
        
        // Log the action
        await auditLogService.logAction(
          superAdmin.id,
          'USER_UPDATED',
          'USER',
          editingUser.id,
          { email: userForm.email, role: userForm.role }
        );
        
        toast({ title: "Success", description: "User updated successfully" });
      } else {
        // Create - with validation
        const { error, data } = await supabase
          .from('users')
          .insert([{
            ...userForm,
            password_hash: userForm.password, // Note: In real app, hash this!
            created_at: new Date().toISOString()
          }])
          .select();
        
        if (error) throw error;
        
        // Log the action
        await auditLogService.logAction(
          superAdmin.id,
          'USER_CREATED',
          'USER',
          data?.[0]?.id || 'UNKNOWN',
          { email: userForm.email, role: userForm.role }
        );
        
        toast({ title: "Success", description: "User created successfully" });
      }
      
      setIsUserModalOpen(false);
      resetUserForm();
      fetchUsers();
      fetchAuditLogs();
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUserLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    // Prevent deletion of SUPERADMIN users
    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete?.role === 'SUPERADMIN') {
      toast({ 
        title: "Cannot Delete", 
        description: "SUPERADMIN users cannot be deleted", 
        variant: "destructive" 
      });
      return;
    }

    if (!window.confirm("Are you sure you want to delete this user?")) return;
    
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) {
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
    } else {
      // Log the action
      await auditLogService.logAction(
        superAdmin.id,
        'USER_DELETED',
        'USER',
        userId,
        { email: userToDelete?.email }
      );
      
      toast({ title: "Deleted", description: "User removed successfully" });
      fetchUsers();
      fetchAuditLogs();
    }
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setUserForm({ full_name: '', email: '', password: '', role: 'USER', status: 'ACTIVE' });
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      full_name: user.full_name,
      email: user.email,
      password: '', // Don't show password
      role: user.role,
      status: user.status
    });
    setIsUserModalOpen(true);
  };

  // ================= SETTINGS FUNCTIONS =================

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    const success = await changePassword(passwordForm.new);
    if (success) {
      setPasswordForm({ current: '', new: '', confirm: '' });
      toast({ title: "Success", description: "Password updated" });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-200 font-sans">
      {/* Header */}
      <header className="bg-black border-b border-neutral-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-red-600" />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">GOD MODE</h1>
            <p className="text-xs text-neutral-500 font-mono">Super Admin Console</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-white">{superAdmin?.name}</p>
            <p className="text-xs text-neutral-500">{superAdmin?.email}</p>
          </div>
          <Button variant="outline" className="border-red-900 text-red-500 hover:bg-red-950 hover:text-red-400" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" /> Disconnect
          </Button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <Tabs defaultValue="pages" className="space-y-6" onValueChange={setActiveTab}>
          <TabsList className="bg-neutral-800 border border-neutral-700 p-1">
            <TabsTrigger value="pages" className="data-[state=active]:bg-neutral-700 text-neutral-400 data-[state=active]:text-white">
              <Activity className="h-4 w-4 mr-2" /> Page Control
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-neutral-700 text-neutral-400 data-[state=active]:text-white">
              <Users className="h-4 w-4 mr-2" /> User Management
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-neutral-700 text-neutral-400 data-[state=active]:text-white">
              <History className="h-4 w-4 mr-2" /> Audit Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-neutral-700 text-neutral-400 data-[state=active]:text-white">
              <Settings className="h-4 w-4 mr-2" /> Security Settings
            </TabsTrigger>
          </TabsList>

          {/* PAGE MANAGEMENT TAB */}
          <TabsContent value="pages" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                   <Activity className="h-5 w-5 text-blue-500" /> Site Availability Control
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Instantly disable specific sections of the platform.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pageLoading ? <div className="text-center py-8"><RefreshCw className="animate-spin h-8 w-8 mx-auto text-neutral-600"/></div> : 
                   pages.map((page) => (
                    <div key={page.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 transition-colors">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`p-2 rounded-full ${page.is_blanked ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                          {page.is_blanked ? <ToggleLeft className="h-6 w-6" /> : <ToggleRight className="h-6 w-6" />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{page.page_name}</h3>
                          <p className="text-xs text-neutral-500 font-mono">{page.page_route}</p>
                        </div>
                      </div>
                      
                      <div className="flex-1 w-full md:w-auto">
                        <div className="flex items-center gap-2">
                           <AlertTriangle className="h-4 w-4 text-yellow-500" />
                           <Input 
                              defaultValue={page.error_message}
                              onBlur={(e) => handlePageMessageChange(page.id, e.target.value)}
                              className="bg-neutral-800 border-neutral-700 text-neutral-300 h-8 text-sm"
                              placeholder="Error message displayed to user..."
                           />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={page.is_blanked ? "destructive" : "default"} className={!page.is_blanked && "bg-green-600"}>
                          {page.is_blanked ? 'OFFLINE' : 'ONLINE'}
                        </Badge>
                        <Switch 
                          checked={!page.is_blanked}
                          onCheckedChange={(isOnline) => {
                            console.log('[PageControl] Toggle changed - isOnline:', isOnline, '- sending is_blanked:', !isOnline);
                            updatePageStatus(page.id, !isOnline, page.error_message);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* USER MANAGEMENT TAB */}
          <TabsContent value="users" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">User Management</CardTitle>
                  <CardDescription className="text-neutral-400">Manage all platform users</CardDescription>
                </div>
                <Button onClick={() => { resetUserForm(); setIsUserModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" /> Create User
                </Button>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-500" />
                    <Input 
                      placeholder="Search users..." 
                      className="pl-8 bg-neutral-800 border-neutral-700 text-white"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[180px] bg-neutral-800 border-neutral-700 text-white">
                      <SelectValue placeholder="Filter by Role" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectItem value="ALL">All Roles</SelectItem>
                      <SelectItem value="USER">User</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="VENDOR">Vendor</SelectItem>
                      <SelectItem value="BUYER">Buyer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={fetchUsers} className="border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                    <RefreshCw className={`h-4 w-4 ${userLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {/* Table */}
                <div className="rounded-md border border-neutral-800 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-neutral-800 text-neutral-400 font-medium">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {users.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-neutral-500">No users found</td></tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user.id} className="hover:bg-neutral-800/50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-white">{user.full_name || 'N/A'}</p>
                              <p className="text-xs text-neutral-500">{user.email}</p>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-blue-400 border-blue-900 bg-blue-900/20">
                                {user.role}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                user.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                              }`}>
                                {user.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-neutral-500">
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="icon" onClick={() => openEditUser(user)} className="h-8 w-8 text-neutral-400 hover:text-white">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)} className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-900/20">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUDIT LOGS TAB */}
          <TabsContent value="audit" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Audit Logs</CardTitle>
                  <CardDescription className="text-neutral-400">All superadmin actions and database modifications</CardDescription>
                </div>
                <Button onClick={fetchAuditLogs} variant="outline" className="border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                  <RefreshCw className={`h-4 w-4 ${auditLoading ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-neutral-800 overflow-hidden">
                  {auditLoading ? (
                    <div className="p-8 text-center"><RefreshCw className="animate-spin h-8 w-8 mx-auto text-neutral-600"/></div>
                  ) : auditLogs.length === 0 ? (
                    <div className="p-8 text-center text-neutral-500">No audit logs found</div>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-neutral-800 text-neutral-400 font-medium">
                        <tr>
                          <th className="px-4 py-3">Timestamp</th>
                          <th className="px-4 py-3">Action</th>
                          <th className="px-4 py-3">Entity</th>
                          <th className="px-4 py-3">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-neutral-800/50">
                            <td className="px-4 py-3 text-neutral-400 text-xs">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-amber-400 border-amber-900 bg-amber-900/20 font-mono text-xs">
                                {log.action}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-neutral-400">{log.entity_type}#{log.entity_id?.substring(0, 8)}</span>
                            </td>
                            <td className="px-4 py-3 text-neutral-500 text-xs">
                              {log.details ? JSON.stringify(log.details).substring(0, 50) + '...' : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-neutral-900 border-neutral-800 max-w-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Lock className="h-5 w-5 text-red-500" /> Super Admin Credentials
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Update your master password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-neutral-400">New Password</Label>
                    <Input 
                      type="password"
                      value={passwordForm.new} 
                      onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                      className="bg-neutral-800 border-neutral-700 text-white" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-neutral-400">Confirm New Password</Label>
                    <Input 
                      type="password"
                      value={passwordForm.confirm} 
                      onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                      className="bg-neutral-800 border-neutral-700 text-white" 
                    />
                  </div>
                  <Button type="submit" className="bg-red-800 hover:bg-red-700 text-white">
                    <Save className="mr-2 h-4 w-4" /> Update Password
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* User Modal */}
      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUserSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input 
                value={userForm.full_name} 
                onChange={e => setUserForm({...userForm, full_name: e.target.value})}
                className="bg-neutral-800 border-neutral-700" required 
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={userForm.email} 
                onChange={e => setUserForm({...userForm, email: e.target.value})}
                className="bg-neutral-800 border-neutral-700" required 
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input 
                  type="password"
                  value={userForm.password} 
                  onChange={e => setUserForm({...userForm, password: e.target.value})}
                  className="bg-neutral-800 border-neutral-700" required 
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={userForm.role} onValueChange={val => setUserForm({...userForm, role: val})}>
                  <SelectTrigger className="bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                    {ALLOWED_ROLES.map(role => (
                      <SelectItem key={role} value={role}>
                        {role.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-neutral-500 mt-1">* Only these roles are allowed</p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={userForm.status} onValueChange={val => setUserForm({...userForm, status: val})}>
                  <SelectTrigger className="bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="BLOCKED">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 mt-4">
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminDashboard;
