import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, Users, FileText, Settings, LogOut,
  Menu, X, Bell, Search, ShieldCheck, HelpCircle, ChevronRight, Boxes,
  BarChart, User as UserIcon, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/modules/vendor/context/AuthContext';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { useSubdomain } from '@/contexts/SubdomainContext';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const getInitials = (name = '') => {
  const parts = String(name).trim().split(' ').filter(Boolean);
  if (!parts.length) return 'V';
  const first = parts[0]?.[0] || 'V';
  const second = parts.length > 1 ? parts[1]?.[0] : (parts[0]?.[1] || '');
  return (first + second).toUpperCase();
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  return `${day}d ago`;
};

const SidebarItem = ({ icon: Icon, label, path, active, collapsed, resolvePath }) => {
  const resolved = resolvePath(path, 'vendor');

  return (
    <Link to={resolved}>
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group mb-1 ${
          active
            ? 'bg-[#003D82] text-white shadow-sm'
            : 'text-neutral-600 hover:bg-neutral-100 hover:text-[#003D82]'
        }`}
      >
        <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-neutral-500 group-hover:text-[#003D82]'}`} />
        {!collapsed && <span className="font-medium text-sm">{label}</span>}
        {active && !collapsed && <motion.div layoutId="activeIndicator" className="ml-auto w-1 h-1 rounded-full bg-white" />}
      </div>
    </Link>
  );
};

const PortalLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { resolvePath } = useSubdomain();

  // ✅ Local "me" for header display (owner_name, profile_image etc.)
  const [me, setMe] = useState(user || null);

  // ✅ Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  const displayOwnerName = useMemo(() => {
    return (
      me?.ownerName ||
      me?.owner_name ||
      me?.name ||
      (me?.email ? me.email.split('@')[0] : '') ||
      'Vendor'
    );
  }, [me]);

  const displayProfileImage = useMemo(() => {
    return me?.profileImage || me?.profile_image || '';
  }, [me]);

  // ✅ FIXED LOGOUT: only context logout
  const handleLogout = async () => {
    await logout();
    const loginPath = resolvePath('login', 'vendor');
    navigate(loginPath);
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: 'dashboard' },
    { icon: ShieldCheck, label: 'KYC & Profile', path: 'kyc' },
    { icon: Package, label: 'Products', path: 'products' },
    { icon: Users, label: 'Leads', path: 'leads' },
    { icon: FileText, label: 'Proposals', path: 'proposals' },
    { icon: BarChart, label: 'Analytics', path: 'analytics' },
    { icon: Boxes, label: 'Subscriptions', path: 'subscriptions' },
    { icon: HelpCircle, label: 'Support', path: 'support' },
    { icon: Settings, label: 'Settings', path: 'settings' },
  ];

  // ✅ Load "me" once to ensure owner_name/profile_image available
  useEffect(() => {
    const loadMe = async () => {
      try {
        const fresh = await vendorApi.auth.me();
        if (fresh) setMe(fresh);
        else setMe(user || null);
      } catch (e) {
        setMe(user || null);
      }
    };
    loadMe();
  }, [user]);

  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const [list, cnt] = await Promise.all([
        vendorApi.notifications.list(8),
        vendorApi.notifications.unreadCount(),
      ]);
      setNotifications(list || []);
      setUnread(cnt || 0);
    } catch (e) {
      setNotifications([]);
      setUnread(0);
    } finally {
      setNotifLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await vendorApi.notifications.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch (e) {}
  };

  const markAllRead = async () => {
    try {
      await vendorApi.notifications.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch (e) {}
  };

  // ✅ Notifications auto-refresh
  useEffect(() => {
    loadNotifications();
    const t = setInterval(loadNotifications, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar - Desktop */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 70 : 250 }}
        className="hidden md:flex flex-col bg-white border-r border-neutral-200 h-screen sticky top-0 z-30 shadow-sm flex-shrink-0"
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-100">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#003D82] rounded flex items-center justify-center text-white font-bold text-lg">V</div>
              <span className="font-bold text-lg text-[#003D82] tracking-tight">VendorPortal</span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-[#003D82] rounded flex items-center justify-center text-white font-bold text-lg mx-auto">V</div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 text-neutral-400 hover:text-[#003D82]"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <div className="bg-neutral-100 p-1 rounded hover:bg-neutral-200">
                <ChevronRight className="h-3 w-3 rotate-180" />
              </div>
            )}
          </Button>
        </div>

        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
          {navItems.map((item) => {
            const resolved = resolvePath(item.path, 'vendor');
            const isActive = location.pathname === resolved || location.pathname.startsWith(`${resolved}/`);

            return (
              <SidebarItem
                key={item.path}
                {...item}
                active={isActive}
                collapsed={collapsed}
                resolvePath={resolvePath}
              />
            );
          })}
        </div>

        <div className="p-3 border-t border-neutral-100 bg-gray-50/50">
          <Button
            variant="ghost"
            className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start'} text-red-600 hover:text-red-700 hover:bg-red-50 hover:shadow-sm`}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && <span className="text-sm font-medium">Logout</span>}
          </Button>
        </div>
      </motion.aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden sm:flex relative items-center">
              <Search className="absolute left-3 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search anything..."
                className="pl-9 pr-4 py-2 bg-neutral-100/50 border border-transparent focus:bg-white focus:border-neutral-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#003D82]/20 w-64 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {/* Notifications dropdown */}
            <DropdownMenu open={notifOpen} onOpenChange={async (open) => {
              setNotifOpen(open);
              if (open) await loadNotifications();
            }}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-neutral-500 hover:text-[#003D82] hover:bg-blue-50">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[11px] rounded-full flex items-center justify-center border-2 border-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[360px] max-w-[90vw] p-0">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="font-semibold text-sm">Notifications</div>
                  <Button size="sm" variant="outline" onClick={markAllRead} disabled={unread === 0}>
                    Mark all read
                  </Button>
                </div>

                <div className="max-h-[340px] overflow-auto">
                  {notifLoading ? (
                    <div className="px-4 py-6 text-sm text-neutral-500">Loading...</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-neutral-500">No notifications yet.</div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-neutral-50 transition ${
                          !n.is_read ? 'bg-[#003D82]/[0.03]' : ''
                        }`}
                        onClick={async () => {
                          if (!n.is_read) await markAsRead(n.id);

                          if (n.link) {
                            if (String(n.link).startsWith('http')) window.open(n.link, '_blank');
                            else navigate(n.link);
                          } else {
                            navigate(resolvePath('support', 'vendor'));
                          }
                          setNotifOpen(false);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-sm text-neutral-800 truncate">
                                {n.title || 'Notification'}
                              </div>
                              {!n.is_read && <span className="h-2 w-2 rounded-full bg-[#003D82]" />}
                            </div>
                            {n.message ? (
                              <div className="text-xs text-neutral-600 mt-1 line-clamp-2">
                                {n.message}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-neutral-500 whitespace-nowrap">
                            {timeAgo(n.created_at)}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="px-4 py-3 border-t flex items-center justify-between">
                  <Button size="sm" variant="ghost" onClick={() => {
                    navigate(resolvePath('support', 'vendor'));
                    setNotifOpen(false);
                  }}>
                    View all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setNotifOpen(false)}>
                    Close
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-6 w-px bg-neutral-200 hidden sm:block"></div>

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 pl-2 rounded-full hover:bg-neutral-50">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-neutral-900 leading-none mb-1">
                      {displayOwnerName}
                    </p>
                    <p className="text-xs text-neutral-500 leading-none">
                      {me?.companyName || me?.company_name || 'Vendor Account'}
                    </p>
                  </div>

                  <div className="h-9 w-9 rounded-full overflow-hidden bg-neutral-100 border flex items-center justify-center shadow-sm cursor-pointer">
                    {displayProfileImage ? (
                      <img src={displayProfileImage} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-neutral-700">{getInitials(displayOwnerName)}</span>
                    )}
                  </div>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => navigate(resolvePath('profile', 'vendor'))}>
                  <UserIcon className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>

                <DropdownMenuItem onClick={async () => {
                  const fresh = await vendorApi.auth.me();
                  if (fresh) setMe(fresh);
                }}>
                  <Check className="mr-2 h-4 w-4" /> Refresh
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => navigate(resolvePath('settings', 'vendor'))}>
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50/50 p-4 sm:p-6 scroll-smooth">
          <div className="max-w-[1600px] mx-auto min-h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-white z-50 md:hidden flex flex-col shadow-2xl"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-100 bg-[#003D82]">
                <span className="font-bold text-lg text-white">Vendor Menu</span>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="text-white hover:bg-white/10">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const resolved = resolvePath(item.path, 'vendor');
                  return (
                    <SidebarItem
                      key={item.path}
                      {...item}
                      active={location.pathname === resolved || location.pathname.startsWith(`${resolved}/`)}
                      collapsed={false}
                      resolvePath={resolvePath}
                    />
                  );
                })}
              </div>

              <div className="p-4 bg-gray-50 border-t border-neutral-200">
                <Button variant="destructive" className="w-full justify-start shadow-sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" /> Logout
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PortalLayout;
