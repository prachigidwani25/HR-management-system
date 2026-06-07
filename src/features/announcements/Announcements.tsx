import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Plus, Loader2, Megaphone, Trash2, Pin, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  pinned: boolean;
  expires_at?: string;
  created_at: string;
  created_by?: string;
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [pinned, setPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch non-expired announcements
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .or(`expires_at.is.null,expires_at.gte.${today}`)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAnnouncements(data as Announcement[]);
    } else if (error) {
      toast.error('Failed to load announcements');
    }
    setIsLoading(false);
  };

  const handleOpenAdd = () => {
    setTitle('');
    setContent('');
    setPriority('LOW');
    setPinned(false);
    setExpiresAt('');
    setFormError('');
    setShowDialog(true);
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!title || !content) {
      setFormError('Title and message content are required.');
      return;
    }
    setIsSubmitting(true);

    try {
      const expVal = expiresAt ? expiresAt : null;
      const { error } = await supabase.from('announcements').insert({
        title,
        content,
        priority,
        pinned,
        expires_at: expVal,
        created_by: user?.id,
      });

      if (error) throw error;

      // Create notifications for all employees
      try {
        const { data: allUsers } = await supabase.from('users').select('id');
        if (allUsers && allUsers.length > 0) {
          const notifInserts = allUsers.map(u => ({
            user_id: u.id,
            title: 'New Announcement Published',
            message: `An announcement titled "${title}" has been published. Check it out on the notice board!`,
            is_read: false
          }));
          await supabase.from('notifications').insert(notifInserts);
        }
      } catch (notifErr) {
        console.error("Failed to insert announcement notifications:", notifErr);
      }

      toast.success('Announcement published successfully!');
      setShowDialog(false);
      fetchAnnouncements();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create announcement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      toast.success('Announcement deleted successfully');
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      toast.error('Failed to delete announcement: ' + err.message);
    }
  };

  const isHrOrAdmin = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER';

  const getPriorityColor = (p: string) => {
    if (p === 'HIGH') return 'bg-rose-50 text-rose-700 border-rose-100';
    if (p === 'MEDIUM') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Announcements Feed</h1>
          <p className="text-sm text-slate-500 mt-1">Stay updated with the latest company news and broadcasts.</p>
        </div>
        {isHrOrAdmin && (
          <Button onClick={handleOpenAdd} className="bg-primary text-white">
            <Plus className="mr-2 h-4 w-4" /> Create Announcement
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Feed */}
        <div className="md:col-span-2 space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-12 bg-white rounded-xl shadow-xs">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : announcements.length === 0 ? (
            <Card className="border-0 shadow-sm bg-white py-12 text-center text-slate-400">
              <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No active announcements at the moment.</p>
            </Card>
          ) : (
            announcements.map((ann) => (
              <Card 
                key={ann.id} 
                className={`border-0 shadow-md hover:shadow-lg transition-all relative ${
                  ann.pinned ? 'bg-gradient-to-r from-indigo-50/20 to-purple-50/10 border-l-4 border-l-indigo-500' : 'bg-white'
                }`}
              >
                <CardContent className="p-6">
                  {ann.pinned && (
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full shadow-xs">
                      <Pin className="h-3.5 w-3.5 fill-indigo-600" />
                      <span>Pinned</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityColor(ann.priority)}`}>
                        {ann.priority} Priority
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        Posted on {format(new Date(ann.created_at), 'MMMM d, yyyy')}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-slate-800 pr-16">{ann.title}</h2>
                      <p className="text-sm text-slate-600 mt-2.5 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-4 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-350" />
                        Expires: {ann.expires_at ? format(new Date(ann.expires_at), 'MMM dd, yyyy') : 'Never'}
                      </span>
                      {isHrOrAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-1 h-7 text-xs font-semibold"
                          onClick={() => handleDelete(ann.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Sidebar Info card */}
        <div className="space-y-4">
          <Card className="border-0 shadow-md bg-white">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-indigo-500" />
                Notice Board Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-xs text-slate-500 space-y-2 leading-relaxed">
              <p>📌 Pinned announcements are shown at the very top of the feed for visibility.</p>
              <p>⚠️ Expiry dates specify when the system will automatically hide the broadcast from user feeds.</p>
              <p>🔴 Admin and HR Managers have permission to post, pin, and manage notices for the entire company workforce.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Announcement Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Publish Announcement</DialogTitle>
            <DialogDescription className="text-slate-500">Broadcast a new notice or message to all employee dashboards.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAnnouncement} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title / Heading</Label>
              <Input id="ann-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 Town Hall Meeting" className="border-slate-200" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ann-content">Message Content</Label>
              <textarea 
                id="ann-content" 
                required 
                rows={4}
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                placeholder="Type your announcement details here..."
                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger className="border-slate-200">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-expiry">Expiry Date (Optional)</Label>
                <Input id="ann-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="border-slate-200" />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
              <input 
                id="ann-pinned" 
                type="checkbox" 
                checked={pinned} 
                onChange={(e) => setPinned(e.target.checked)}
                className="h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <Label htmlFor="ann-pinned" className="text-slate-700 cursor-pointer select-none">Pin this announcement to the top of the feed</Label>
            </div>

            {formError && <p className="text-xs text-rose-600 font-semibold">{formError}</p>}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-white">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publish Announcement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
