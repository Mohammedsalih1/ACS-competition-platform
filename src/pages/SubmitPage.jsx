import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CheckCircle2, AlertCircle, Loader2, Upload, Link } from 'lucide-react';
import FileDropZone from '../components/submission/FileDropZone';

const schema = z.object({
  title: z.string().min(1, 'Project title is required').max(200, 'Title must be under 200 characters'),
  description: z.string().max(1000, 'Description must be under 1000 characters').optional(),
  liveUrl: z.string().trim().url('Must be a valid URL (e.g. https://...)').max(2048).optional().or(z.literal('')),
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
  const [searchParams, setSearchParams] = useSearchParams();
  const draftId = searchParams.get('draft');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [stage, setStage] = useState(STAGES.IDLE);
  const [error, setError] = useState(null);
  const [submissionId, setSubmissionId] = useState(draftId);
  const [isLoadingDraft, setIsLoadingDraft] = useState(Boolean(draftId));
  const [draftLoadError, setDraftLoadError] = useState(null);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', liveUrl: '' },
  });

  useEffect(() => {
    if (!draftId) return undefined;

    let active = true;
    api(`/submissions/${draftId}`)
      .then(({ submission }) => {
        if (!active) return;
        if (submission.status !== 'draft') {
          setDraftLoadError('This submission is no longer a draft and cannot be continued here.');
          return;
        }
        setSubmissionId(submission.id);
        form.reset({
          title: submission.title || '',
          description: submission.description || '',
          liveUrl: submission.liveUrl || '',
        });
      })
      .catch((err) => {
        if (active) setDraftLoadError(err.message || 'Could not load this draft.');
      })
      .finally(() => {
        if (active) setIsLoadingDraft(false);
      });

    return () => { active = false; };
  }, [draftId, form]);

  const titleValue = useWatch({ control: form.control, name: 'title' }) || '';
  const descValue = useWatch({ control: form.control, name: 'description' }) || '';

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
    let createdSubmissionId = null;

    try {
      const submissionData = {
        title: data.title,
        description: data.description || '',
        liveUrl: data.liveUrl || '',
      };
      let activeSubmissionId = submissionId;

      if (activeSubmissionId) {
        await api(`/submissions/${activeSubmissionId}`, {
          method: 'PATCH',
          body: JSON.stringify(submissionData),
        });
      } else {
        const submission = await api('/submissions', {
          method: 'POST',
          body: JSON.stringify(submissionData),
        });
        activeSubmissionId = submission.id;
        createdSubmissionId = activeSubmissionId;
        setSubmissionId(activeSubmissionId);
      }

      // Upload the ZIP after creating or updating the submission details.
      setStage(STAGES.UPLOADING);
      const formData = new FormData();
      formData.append('projectFile', file);

      await api(`/submissions/${activeSubmissionId}/upload`, {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type — the browser must set it with the multipart boundary
      });

      setStage(STAGES.SUCCESS);
    } catch (err) {
      setStage(STAGES.IDLE);
      if (createdSubmissionId) {
        setSearchParams({ draft: createdSubmissionId }, { replace: true });
      }
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

  if (isLoadingDraft || draftLoadError) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[40vh]">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 px-8 space-y-4">
            {isLoadingDraft ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground">Loading your draft...</p>
              </>
            ) : (
              <>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{draftLoadError}</AlertDescription>
                </Alert>
                <Button className="w-full" onClick={() => navigate('/dashboard')}>
                  Back to Dashboard
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSubmitting = stage === STAGES.CREATING || stage === STAGES.UPLOADING;
  const submitLabel =
    stage === STAGES.CREATING ? submissionId ? 'Saving submission...' : 'Creating submission...' :
    stage === STAGES.UPLOADING ? 'Uploading ZIP...' :
    'Submit Project';

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-primary">
          {submissionId ? 'Continue Your Submission' : 'Submit Your Project'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {submissionId
            ? 'Review your project details and upload the ZIP file to complete your submission'
            : 'Fill in your project details and upload your ZIP file'}
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

              {/* Live Demo URL */}
              <FormField
                control={form.control}
                name="liveUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Live Demo URL{' '}
                      <span className="text-muted-foreground text-xs">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          type="url"
                          placeholder="https://your-project.vercel.app"
                          className="pl-9"
                          maxLength={2048}
                          {...field}
                        />
                      </div>
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

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !!fileError || !file}
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{submitLabel}</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" />{submissionId ? 'Complete Submission' : 'Submit Project'}</>
                )}
              </Button>

            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
