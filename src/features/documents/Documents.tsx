import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, Upload, FileText, Download, Trash2, FolderOpen } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';

interface Document {
  id: string;
  user_id?: string;
  title: string;
  file_url: string;
  document_type: string;
  uploaded_by?: string;
  created_at: string;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    if (!user) return;
    setIsLoading(true);

    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (user.role === 'EMPLOYEE') {
      query = query.or(`user_id.eq.${user.id},user_id.is.null`);
    }

    const { data } = await query;
    setDocuments((data || []) as Document[]);
    setIsLoading(false);
  };

  const handleUpload = async () => {
    if (!user || !selectedFile || !title) return;
    setIsUploading(true);

    const fileExt = selectedFile.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, selectedFile);

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setIsUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage.from('documents').getPublicUrl(uploadData.path);

    await supabase.from('documents').insert({
      user_id: user.role === 'EMPLOYEE' ? user.id : null,
      title,
      file_url: publicData.publicUrl,
      document_type: docType || 'General',
      uploaded_by: user.id,
    });

    setShowDialog(false);
    setTitle('');
    setDocType('');
    setSelectedFile(null);
    await fetchDocuments();
    setIsUploading(false);
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm('Delete this document?')) return;
    await supabase.from('documents').delete().eq('id', doc.id);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const canDelete = (doc: Document) =>
    user?.role === 'ADMIN' || user?.role === 'HR_MANAGER' || doc.uploaded_by === user?.id;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500">Manage and access company documents.</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            All Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-slate-400">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      No documents found.
                    </TableCell>
                  </TableRow>
                )}
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-700">{doc.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                        {doc.document_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{formatDate(doc.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 text-blue-500" />
                          </a>
                        </Button>
                        {canDelete(doc) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(doc)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Document Title</Label>
              <Input
                id="doc-title"
                placeholder="e.g. Employment Contract"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-type">Document Type</Label>
              <Input
                id="doc-type"
                placeholder="e.g. Contract, Policy, ID Proof"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>File</Label>
              <div
                className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="text-sm text-slate-600">
                    <FileText className="h-6 w-6 mx-auto mb-2 text-primary" />
                    {selectedFile.name}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">
                    <Upload className="h-6 w-6 mx-auto mb-2" />
                    Click to select a file
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={isUploading || !title || !selectedFile}>
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
