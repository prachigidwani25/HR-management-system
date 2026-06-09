import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Plus, Loader2, Calendar, Trash2, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { parseLocalDate } from '../../lib/utils';

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  type: 'NATIONAL' | 'COMPANY';
  description?: string;
  created_at?: string;
}

export default function HolidaysPage() {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<'NATIONAL' | 'COMPANY'>('NATIONAL');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .order('holiday_date', { ascending: true });

    if (!error && data) {
      setHolidays(data as Holiday[]);
    } else if (error) {
      toast.error('Failed to load holidays');
    }
    setIsLoading(false);
  };

  const handleOpenAdd = () => {
    setName('');
    setDate('');
    setType('NATIONAL');
    setDescription('');
    setFormError('');
    setShowDialog(true);
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!name || !date || !type) {
      setFormError('All fields are required.');
      return;
    }
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('holidays').insert({
        name,
        holiday_date: date,
        type,
        description,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success('Holiday created successfully!');
      setShowDialog(false);
      fetchHolidays();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create holiday');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    try {
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;
      toast.success('Holiday deleted successfully');
      setHolidays(prev => prev.filter(h => h.id !== id));
    } catch (err: any) {
      toast.error('Failed to delete holiday: ' + err.message);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Holiday Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">View and plan around national and company holidays.</p>
        </div>
        {isAdmin && (
          <Button onClick={handleOpenAdd} className="bg-primary text-white">
            <Plus className="mr-2 h-4 w-4" /> Add Holiday
          </Button>
        )}
      </div>

      <Card className="border-0 shadow-md bg-white">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-800">
            <Calendar className="h-5 w-5 text-indigo-500" />
            Holiday Schedule
          </CardTitle>
          <CardDescription>Company-wide non-working days for the calendar year.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No holidays scheduled yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-55 bg-indigo-50/50 rounded-xl flex flex-col items-center justify-center border border-indigo-100 shrink-0">
                      <span className="text-[10px] text-indigo-500 font-bold uppercase">{format(parseLocalDate(h.holiday_date), 'MMM')}</span>
                      <span className="text-lg font-extrabold text-indigo-700 leading-none">{format(parseLocalDate(h.holiday_date), 'd')}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{h.name}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-slate-300" />
                        {format(parseLocalDate(h.holiday_date), 'EEEE')} | <span className="capitalize">{h.type.toLowerCase()} Holiday</span>
                      </p>
                      {h.description && (
                        <p className="text-xs text-slate-500 mt-1.5 italic">{h.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pr-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      h.type === 'NATIONAL' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      {h.type}
                    </span>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                        onClick={() => handleDelete(h.id)}
                        title="Delete Holiday"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Holiday Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Add New Holiday</DialogTitle>
            <DialogDescription className="text-slate-500">Insert a public or company-wide holiday into the schedule.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddHoliday} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Holiday Title</Label>
              <Input id="holiday-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Independence Day" className="border-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="holiday-date">Date</Label>
                <Input id="holiday-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(val: any) => setType(val)}>
                  <SelectTrigger className="border-slate-200">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NATIONAL">National Holiday</SelectItem>
                    <SelectItem value="COMPANY">Company Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="holiday-desc">Description (Optional)</Label>
              <Input id="holiday-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief note about the holiday" className="border-slate-200" />
            </div>

            {formError && <p className="text-xs text-rose-600 font-semibold">{formError}</p>}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-white">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Holiday
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
