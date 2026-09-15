import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CheckCircle2, AlertCircle, Loader2, Upload } from 'lucide-react';
import FileDropZone from '../components/submission/FileDropZone';

const schema = z.object({
  title: z.string().min(1, 'Project title is required').max(200, 'Title must be under 200 characters'),
  description: z.string().max(1000, 'Description must be under 1000 characters').optional(),
  liveUrl: z.string().min(1, 'Live URL is required').url('Please enter a valid URL including https://'),
});

// Map backend error codes to user-friendly messages
const ERROR_MESSAGES = {
  VALIDATION_ERROR: null,
  FILE_REQUIRED: 'Please select a ZIP file to upload.',
  FILE_TOO_LARGE: 'File is too large. Maximum size is 50 MB.',
  UNSUPPORTED_FILE_TYPE: 'Only ZIP files are accepted.',
  CORRUPT_ARCHIVE: 'The ZIP file appears to be corrupted or empty. Please check and try again.',
  UPLOAD_FAILED: 'Upload failed. Please try again.',
  INSUFFICIENT_ROLE: 'Only contestants can submit projects.',
  default: 'Something went wrong. Please try again.',
};

// Submission has two stages
const STAGES = { IDLE: 'idle', CREATING: 'creating', UPLOADING: 'uploading', SUCCESS: 'success' };

export default function SubmitPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [stage, setStage] = useState(STAGES.IDLE);
  const [error, setError] = useState(null);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', liveUrl: '' },
  });

  const titleValue = form.watch('title') || '';
  const descValue = form.watch('description') || '';

  const handleFileSelect = (selectedFile, err) => {
    setFile(selectedFile);
    setFileError(err);
  };

  const onSubmit = async (data) => {
    // Validate file is present
    if (!file) {
      setFileError('Please select a ZIP file to upload.');
      return;
    }

    setError(null);
    setStage(STAGES.CREATING);

    try {
      // Stage 1: Create the submission record
      const submission = await api('/submissions', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          description: data.description || '',
        }),
      });

      // Stage 2: Upload the ZIP file
      setStage(STAGES.UPLOADING);
      const formData = new FormData();
      formData.append('projectFile', file);

      await api(`/submissions/${submission.id}/upload`, {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type — the browser must set it with the multipart boundary
      });

      setStage(STAGES.SUCCESS);
    } catch (err) {
      setStage(STAGES.IDLE);
      const code = err?.code || 'default';

      // Handle field-level validation errors from the backend
      if (code === 'VALIDATION_ERROR' && Array.isArray(err?.details)) {
        err.details.forEach(({ field, message }) => {
          if (field === 'title' || field === 'description' || field === 'liveUrl') {
            form.setError(field, { message });
          }
        });
        return;
      }

      setError(ERROR_MESSAGES[code] || ERROR_MESSAGES.default);
    }
  };

  // Success screen
  if (stage === STAGES.SUCCESS) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 px-8 space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-primary">Project Submitted!</h2>
            <p className="text-muted-foreground">
              Your project has been uploaded successfully and is now under review.
            </p>
            <Button className="w-full mt-2" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSubmitting = stage === STAGES.CREATING || stage === STAGES.UPLOADING;
  const submitLabel =
    stage === STAGES.CREATING ? 'Creating submission...' :
    stage === STAGES.UPLOADING ? 'Uploading ZIP...' :
    'Submit Project';

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-primary">Submit Your Project</h1>
        <p className="text-muted-foreground mt-1">
          Fill in your project details and upload your ZIP file
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="animate-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project Details</CardTitle>
          <CardDescription>Provide information about your project</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel>Project Title <span className="text-destructive">*</span></FormLabel>
                      <span className="text-xs text-muted-foreground">{titleValue.length}/200</span>
                    </div>
                    <FormControl>
                      <Input placeholder="My Awesome Project" maxLength={200} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel>Description <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                      <span className="text-xs text-muted-foreground">{descValue.length}/1000</span>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Briefly describe your project..."
                        maxLength={1000}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ZIP Upload */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium leading-none">
                  Project ZIP File <span className="text-destructive">*</span>
                </label>
                <FileDropZone
                  onFileSelect={handleFileSelect}
                  file={file}
                  error={fileError}
                />
              </div>

              {/* Live URL */}
              <FormField
                control={form.control}
                name="liveUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Live URL <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://your-project.com"
                        type="url"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !!fileError || !file}
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{submitLabel}</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" />Submit Project</>
                )}
              </Button>

            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}