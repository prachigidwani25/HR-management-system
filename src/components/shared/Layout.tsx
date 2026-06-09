import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  Settings,
  LogOut,
  Clock,
  Bell,
  Menu,
  Calendar,
  Check,
  CheckSquare,
  Terminal,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function Layout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Notification states
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();

    if (user) {
      // Setup realtime listener for notifications
      const channel = supabase
        .channel(`public:notifications:user_id=eq.${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error && data) {
      setNotifications(data as NotificationItem[]);
      if (!countError) {
        setUnreadCount(count || 0);
      } else {
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    }
  };

  const handleMarkAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard',     path: '/',              icon: LayoutDashboard, roles: ['ADMIN', 'HR_MANAGER', 'EMPLOYEE'] },
    { name: 'Employees',     path: '/employees',     icon: Users,           roles: ['ADMIN', 'HR_MANAGER'] },
    { name: 'Attendance',    path: '/attendance',    icon: Clock,           roles: ['ADMIN', 'HR_MANAGER', 'EMPLOYEE'] },
    { name: 'Leave',         path: '/leave',         icon: CalendarDays,    roles: ['ADMIN', 'HR_MANAGER', 'EMPLOYEE'] },
    { name: 'Holidays',      path: '/holidays',      icon: Calendar,        roles: ['ADMIN', 'HR_MANAGER', 'EMPLOYEE'] },
    { name: 'Announcements', path: '/announcements', icon: Bell,            roles: ['ADMIN', 'HR_MANAGER', 'EMPLOYEE'] },
    { name: 'Documents',     path: '/documents',     icon: FileText,        roles: ['ADMIN', 'HR_MANAGER', 'EMPLOYEE'] },
    { name: 'Settings',      path: '/settings',      icon: Settings,        roles: ['ADMIN', 'HR_MANAGER', 'EMPLOYEE'] },
    { name: 'System Tests',  path: '/system-tests',  icon: Terminal,        roles: ['ADMIN', 'HR_MANAGER', 'EMPLOYEE'] },
  ];

  const filteredNav = navItems.filter(item =>
    item.roles.includes(user?.role || '')
  );

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Users className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">HRMS Portal</h1>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-2 bg-slate-50 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-slate-500 capitalize truncate">
              {user?.role?.replace('_', ' ').toLowerCase()}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 text-sm"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r hidden md:flex flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white z-50 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="md:hidden font-bold text-slate-800">HRMS</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Realtime Notification Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-slate-100">
                  <Bell className="h-5 w-5 text-slate-600" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-white border-0 shadow-lg p-2 space-y-1 rounded-xl">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <span className="font-bold text-slate-850 text-sm">Notifications ({unreadCount})</span>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      onClick={handleMarkAllAsRead} 
                      className="h-auto p-0 text-xs font-semibold text-primary hover:bg-transparent"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>

                <div className="max-h-[300px] overflow-y-auto divide-y">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <DropdownMenuItem 
                        key={n.id} 
                        className={cn(
                          "flex flex-col items-start gap-1 p-3 rounded-lg focus:bg-slate-50 cursor-pointer text-left transition-colors",
                          !n.is_read ? "bg-slate-50/50" : ""
                        )}
                        onClick={() => handleMarkAsRead(n.id)}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <span className={cn("font-bold text-slate-800 text-xs truncate", !n.is_read ? "text-indigo-600" : "")}>{n.title}</span>
                          {!n.is_read && (
                            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-650 leading-relaxed break-words w-full">{n.message}</p>
                        <span className="text-[9px] text-slate-400 mt-1">{format(new Date(n.created_at), 'MMM d, h:mm a')}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
