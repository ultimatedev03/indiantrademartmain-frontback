
import React, { useState, useEffect, useRef } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

const NotificationBell = ({ userId: userIdProp = null }) => {
  const [userId, setUserId] = useState(userIdProp);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [taskUpdatingId, setTaskUpdatingId] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    if (userIdProp) {
      setUserId(userIdProp);
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (mounted) setUserId(user?.id || null);
      } catch {
        if (mounted) setUserId(null);
      }
    };

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id || null);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, [userIdProp]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications(userId);

    // Real-time subscription
    const channel = supabase
      .channel(`notifications-realtime:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
          setUnreadCount((prev) => prev + 1);
          toast({
            title: payload.new.title,
            description: payload.new.message,
            className: "bg-white border-l-4 border-blue-600"
          });
        }
      )
      .subscribe();

    // Polling fallback (in case realtime is disabled)
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      fetchNotifications(userId);
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [userId]);

  const fetchNotifications = async (id) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error("Fetch notifications error:", error);
    }
  };

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking read:", error);
    }
  };

  const deleteNotification = async (id, e) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const notif = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notif && !notif.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const markAllRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all read:", error);
    }
  };

  const getCategoryRequestId = (notif) => {
    const link = notif?.link;
    if (link) {
      try {
        const url = new URL(link, window.location.origin);
        const id = url.searchParams.get('category_request');
        if (id) return id;
      } catch {
        // ignore
      }
    }
    const msg = String(notif?.message || '');
    const match = msg.match(/ticket[:\s#]*([a-f0-9-]{36})/i);
    return match ? match[1] : null;
  };

  const getTaskStatus = (notif) => {
    const msg = String(notif?.message || '');
    const match = msg.match(/status[:\s]*([A-Z_]+)/i);
    return (match?.[1] || 'ASSIGNED').toString().toUpperCase();
  };

  const isCategoryTask = (notif) => notif?.type === 'CATEGORY_REQUEST' && Boolean(getCategoryRequestId(notif));

  const updateTaskStatus = async (notif, nextStatus, event) => {
    if (event?.stopPropagation) event.stopPropagation();
    const taskId = getCategoryRequestId(notif);
    if (!taskId) return;
    if (taskUpdatingId) return;

    setTaskUpdatingId(notif.id);
    try {
      const res = await fetchWithCsrf(apiUrl(`/api/category-requests/${taskId}/status`), {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update task');
      }
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== notif.id) return n;
          const msg = String(n.message || '');
          const nextMsg = msg.match(/status[:\s]*[A-Z_]+/i)
            ? msg.replace(/status[:\s]*[A-Z_]+/i, `Status: ${nextStatus}`)
            : `${msg} | Status: ${nextStatus}`;
          return { ...n, message: nextMsg };
        })
      );
      toast({
        title: nextStatus === 'DONE' ? 'Marked done' : 'Status updated',
        description: `Task status: ${String(nextStatus).replace('_', ' ')}`,
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error?.message || 'Could not update task status',
        variant: 'destructive',
      });
    } finally {
      setTaskUpdatingId(null);
    }
  };

  const formatStatus = (status) => String(status || '').replace('_', ' ');
  const isDataEntryView = typeof window !== 'undefined' && window.location.pathname.startsWith('/employee/dataentry');
  const statusClasses = (status) => {
    switch (status) {
      case 'DONE':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'IN_PROGRESS':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'CANCELLED':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'UNASSIGNED':
        return 'text-slate-600 bg-slate-50 border-slate-200';
      default:
        return 'text-blue-700 bg-blue-50 border-blue-200';
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-[#003D82] hover:bg-blue-50">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-500 rounded-full border border-white animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/50">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="xs" onClick={markAllRead} className="h-auto px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-400">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => {
                const isTask = isCategoryTask(notif);
                const taskStatus = getTaskStatus(notif);
                const isAssignee = isDataEntryView;
                const isUpdating = taskUpdatingId === notif.id;

                return (
                  <div 
                    key={notif.id} 
                    className={cn(
                      "relative p-4 hover:bg-gray-50 transition-colors cursor-pointer group",
                      !notif.is_read && "bg-blue-50/30"
                    )}
                    onClick={() => markAsRead(notif.id)}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        "mt-1 h-2 w-2 rounded-full flex-shrink-0",
                        !notif.is_read ? "bg-blue-500" : "bg-transparent"
                      )} />
                      <div className="flex-1 space-y-1">
                        <p className={cn("text-sm font-medium leading-none", !notif.is_read ? "text-gray-900" : "text-gray-600")}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {notif.message}
                        </p>
                        {isTask && (
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                            <span className={cn("px-1.5 py-0.5 rounded border", statusClasses(taskStatus))}>
                              {formatStatus(taskStatus)}
                            </span>
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400">
                          {new Date(notif.created_at).toLocaleDateString()} at {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {isTask && isAssignee && taskStatus !== 'DONE' && (
                          <div className="flex gap-2 pt-1">
                            {taskStatus !== 'IN_PROGRESS' && (
                              <Button
                                variant="outline"
                                size="xs"
                                disabled={isUpdating}
                                onClick={(e) => updateTaskStatus(notif, 'IN_PROGRESS', e)}
                              >
                                {isUpdating ? '...' : 'Start'}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={isUpdating}
                              onClick={(e) => updateTaskStatus(notif, 'DONE', e)}
                            >
                              {isUpdating ? '...' : 'Mark Done'}
                            </Button>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600"
                        onClick={(e) => deleteNotification(notif.id, e)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
