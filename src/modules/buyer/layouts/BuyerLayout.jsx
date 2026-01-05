
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useBuyerAuth } from '@/modules/buyer/context/AuthContext';
import { useSubdomain } from '@/contexts/SubdomainContext';
import { 
  LayoutDashboard, FileText, PlusCircle, User, LogOut, 
  Menu, Bell, Search, MessageSquare, Ticket, Heart, Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import Logo from '@/shared/components/Logo';

const SidebarLink = ({ to, icon: Icon, children, onClick }) => {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors min-h-[48px] ${
          isActive 
            ? 'bg-[#003D82] text-white' 
            : 'text-neutral-600 hover:bg-neutral-100 hover:text-[#003D82]'
        }`
      }
    >
      <Icon className="h-5 w-5" />
      <span className="font-medium text-base md:text-sm">{children}</span>
    </NavLink>
  );
};

const BuyerLayout = () => {
  const { user, logout } = useBuyerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { resolvePath } = useSubdomain();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getPageTitle = () => {
    const path = location.pathname.split('/').pop();
    if (path === 'dashboard') return 'Buyer Dashboard';
    if (path === 'create') return 'Create Proposal';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  const SidebarContent = ({ mobile = false }) => (
    <div className="flex flex-col h-full">
      {!mobile && (
        <div className="h-20 flex items-center justify-center border-b border-neutral-100 px-4">
           <Logo className="h-8" />
        </div>
      )}
      
      <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
        <SidebarLink to={resolvePath('dashboard', 'buyer')} icon={LayoutDashboard} onClick={() => setIsMobileMenuOpen(false)}>Dashboard</SidebarLink>
        <SidebarLink to={resolvePath('proposals', 'buyer')} icon={FileText} onClick={() => setIsMobileMenuOpen(false)}>My Proposals</SidebarLink>
        <SidebarLink to={resolvePath('proposals/new', 'buyer')} icon={PlusCircle} onClick={() => setIsMobileMenuOpen(false)}>New Proposal</SidebarLink>
        <SidebarLink to={resolvePath('messages', 'buyer')} icon={MessageSquare} onClick={() => setIsMobileMenuOpen(false)}>Messages</SidebarLink>
        <SidebarLink to={resolvePath('tickets', 'buyer')} icon={Ticket} onClick={() => setIsMobileMenuOpen(false)}>Support Tickets</SidebarLink>
        <SidebarLink to={resolvePath('favorites', 'buyer')} icon={Heart} onClick={() => setIsMobileMenuOpen(false)}>Favorites</SidebarLink>
        <SidebarLink to={resolvePath('suggestions', 'buyer')} icon={Lightbulb} onClick={() => setIsMobileMenuOpen(false)}>Suggestions</SidebarLink>
        <SidebarLink to={resolvePath('profile', 'buyer')} icon={User} onClick={() => setIsMobileMenuOpen(false)}>Profile</SidebarLink>
      </nav>

      <div className="p-4 border-t border-neutral-100 bg-neutral-50/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-[#00A699] flex items-center justify-center text-white font-bold text-lg">
            {user?.name?.[0] || 'B'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-neutral-900 truncate">{user?.name}</p>
            <p className="text-xs text-neutral-500 truncate">{user?.company}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 h-11"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-neutral-200 fixed inset-y-0 z-50">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-300">
        <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden -ml-2">
                  <Menu className="h-6 w-6 text-neutral-600" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-0">
                <SheetHeader className="p-4 border-b text-left">
                  <Logo className="h-6" />
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                </SheetHeader>
                <SidebarContent mobile />
              </SheetContent>
            </Sheet>
            
            <h1 className="text-lg md:text-xl font-semibold text-neutral-800 truncate max-w-[200px] md:max-w-none">
              {getPageTitle()}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
             <Link to="/search">
               <Button variant="ghost" size="icon" className="h-10 w-10">
                 <Search className="h-5 w-5 text-neutral-500" />
               </Button>
             </Link>
             <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => toast({ title: "No new notifications" })}>
               <Bell className="h-5 w-5 text-neutral-500" />
             </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default BuyerLayout;
