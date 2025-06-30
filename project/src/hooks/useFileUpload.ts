import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileRecord } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'tagging' | 'complete' | 'error';
  error?: string;
}

const N8N_WEBHOOK_URL = 'https://njord-gear.app.n8n.cloud/webhook/d2855857-3e7b-4465-b627-89ed188f2151';

export const useFileUpload = () => {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { currentWorkspace } = useWorkspace();

  const getFileCategory = (mimeType: string): FileRecord['file_category'] => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return 'archive';
    return 'other';
  };

  const generatePublicUrl = (filePath: string): string => {
    // Generate public URL using Supabase storage
    const { data } = supabase.storage.from('files').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const generateThumbnail = async (file: File): Promise<{ thumbnailPath: string | null; thumbnailUrl: string | null }> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const img = new Image();
          img.onload = async () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              // Set thumbnail size
              const maxSize = 300;
              let { width, height } = img;
              
              if (width > height) {
                if (width > maxSize) {
                  height = (height * maxSize) / width;
                  width = maxSize;
                }
              } else {
                if (height > maxSize) {
                  width = (width * maxSize) / height;
                  height = maxSize;
                }
              }
              
              canvas.width = width;
              canvas.height = height;
              
              ctx?.drawImage(img, 0, 0, width, height);
              
              // Create thumbnail blob for upload
              const thumbnailBlob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((blob) => {
                  resolve(blob!);
                }, 'image/jpeg', 0.8);
              });
              
              // Generate thumbnail path
              const timestamp = Date.now();
              const randomId = Math.random().toString(36).substring(2);
              let thumbnailPath = `thumbnails/${currentWorkspace?.id}`;
              
              thumbnailPath += `/thumb-${timestamp}-${randomId}.jpg`;
              
              // Upload thumbnail to storage
              const { error: thumbError } = await supabase.storage
                .from('files')
                .upload(thumbnailPath, thumbnailBlob, {
                  cacheControl: '3600',
                  upsert: false
                });
              
              if (thumbError) {
                console.warn('Thumbnail upload failed:', thumbError);
                resolve({ thumbnailPath: null, thumbnailUrl: null });
                return;
              }
              
              // Get public URL for thumbnail
              const thumbnailUrl = generatePublicUrl(thumbnailPath);
              resolve({ thumbnailPath, thumbnailUrl });
              
            } catch (error) {
              console.warn('Thumbnail generation failed:', error);
              resolve({ thumbnailPath: null, thumbnailUrl: null });
            }
          };
          img.onerror = () => resolve({ thumbnailPath: null, thumbnailUrl: null });
          img.src = e.target?.result as string;
        };
        reader.onerror = () => resolve({ thumbnailPath: null, thumbnailUrl: null });
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        // Generate video thumbnail
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        video.onloadedmetadata = async () => {
          try {
            video.currentTime = Math.min(2, video.duration / 4); // Seek to 25% or 2 seconds
          } catch (error) {
            resolve({ thumbnailPath: null, thumbnailUrl: null });
          }
        };
        
        video.onseeked = async () => {
          try {
            const maxSize = 300;
            let { videoWidth: width, videoHeight: height } = video;
            
            if (width > height) {
              if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx?.drawImage(video, 0, 0, width, height);
            
            // Create video thumbnail blob
            const thumbnailBlob = await new Promise<Blob>((resolve) => {
              canvas.toBlob((blob) => {
                resolve(blob!);
              }, 'image/jpeg', 0.8);
            });
            
            // Generate thumbnail path
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2);
            let thumbnailPath = `thumbnails/${currentWorkspace?.id}`;
            
            thumbnailPath += `/thumb-${timestamp}-${randomId}.jpg`;
            
            // Upload thumbnail to storage
            const { error: thumbError } = await supabase.storage
              .from('files')
              .upload(thumbnailPath, thumbnailBlob, {
                cacheControl: '3600',
                upsert: false
              });
            
            if (thumbError) {
              console.warn('Video thumbnail upload failed:', thumbError);
              resolve({ thumbnailPath: null, thumbnailUrl: null });
              return;
            }
            
            // Get public URL for thumbnail
            const thumbnailUrl = generatePublicUrl(thumbnailPath);
            resolve({ thumbnailPath, thumbnailUrl });
            
          } catch (error) {
            console.warn('Video thumbnail generation failed:', error);
            resolve({ thumbnailPath: null, thumbnailUrl: null });
          }
        };
        
        video.onerror = () => resolve({ thumbnailPath: null, thumbnailUrl: null });
        video.src = URL.createObjectURL(file);
        video.load();
      } else {
        resolve({ thumbnailPath: null, thumbnailUrl: null });
      }
    });
  };

  const updateUploadProgress = (fileId: string, progress: number, status?: UploadProgress['status'], error?: string) => {
    setUploads(prev => prev.map(u => 
      u.fileId === fileId ? { 
        ...u, 
        progress: Math.min(100, Math.max(0, progress)),
        ...(status && { status }),
        ...(error && { error })
      } : u
    ));
  };

  const sendToN8nWebhook = async (fileData: FileRecord, fileUrl: string, thumbnailUrl: string | null, autoTaggingEnabled: boolean) => {
    if (!autoTaggingEnabled) {
      console.log('Auto-tagging disabled, skipping n8n webhook');
      return;
    }

    try {
      console.log('Sending file data to n8n webhook for auto-tagging...');
      
      // Prepare optimized payload for n8n
      const webhookPayload = {
        fileId: fileData.id,
        fileName: fileData.name,
        originalName: fileData.original_name,
        fileType: fileData.file_type,
        fileCategory: fileData.file_category,
        fileSize: fileData.file_size,
        fileUrl: fileUrl, // Public Supabase URL for file access
        thumbnailUrl: thumbnailUrl, // Public thumbnail URL for visual analysis
        filePath: fileData.file_path,
        workspaceId: fileData.workspace_id,
        projectId: fileData.project_id,
        folderId: fileData.folder_id,
        timestamp: new Date().toISOString(),
        context: {
          workspace: currentWorkspace?.name,
          uploadSource: 'filevault-web'
        }
      };

      console.log('Webhook payload:', {
        fileId: webhookPayload.fileId,
        fileName: webhookPayload.fileName,
        fileUrl: webhookPayload.fileUrl,
        thumbnailUrl: webhookPayload.thumbnailUrl
      });

      // Send request to n8n webhook
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('N8N webhook response:', result);

      // Check if n8n returned tags immediately
      if (result.tags && Array.isArray(result.tags) && result.tags.length > 0) {
        console.log('Received immediate tags from n8n:', result.tags);
        
        // Update file tags in database
        const { error: updateError } = await supabase
          .from('files')
          .update({ tags: result.tags })
          .eq('id', fileData.id);

        if (updateError) {
          console.error('Failed to update file tags:', updateError);
        } else {
          console.log('Successfully updated file tags:', result.tags);
        }
      } else {
        console.log('N8N will process tags asynchronously');
      }

    } catch (error) {
      console.error('Failed to send file to n8n webhook:', error);
      // Don't throw error here - auto-tagging failure shouldn't break the upload
    }
  };

  const uploadFiles = async (
    files: FileList | File[], 
    manualTags: string[] = [], 
    autoTaggingEnabled: boolean = true,
    overrideProjectId?: string | null,
    overrideFolderId?: string | null
  ) => {
    if (!files.length || !currentWorkspace) {
      if (!currentWorkspace) {
        throw new Error('No workspace available');
      }
      return [];
    }

    setIsUploading(true);
    const fileArray = Array.from(files);
    
    try {
      console.log('Starting upload process for', fileArray.length, 'files to workspace:', currentWorkspace.name);
      console.log('Auto-tagging enabled:', autoTaggingEnabled);
      console.log('Manual tags:', manualTags);
      
      // Determine target project and folder
      const targetProjectId = overrideProjectId !== undefined ? overrideProjectId : null;
      const targetFolderId = overrideFolderId !== undefined ? overrideFolderId : null;
      
      if (targetProjectId) {
        console.log('Uploading to project:', targetProjectId);
        if (targetFolderId) {
          console.log('Uploading to folder:', targetFolderId);
        } else {
          console.log('Uploading to project root');
        }
      }

      // Initialize upload progress
      const initialUploads: UploadProgress[] = fileArray.map((file, index) => ({
        fileId: `upload-${Date.now()}-${index}`,
        fileName: file.name,
        progress: 0,
        status: 'uploading' as const,
      }));
      
      setUploads(initialUploads);

      const uploadPromises = fileArray.map(async (file, index) => {
        const uploadId = initialUploads[index].fileId;
        
        try {
          console.log(`Starting upload for file: ${file.name}`);
          updateUploadProgress(uploadId, 5);

          // Generate unique file path with workspace prefix
          const fileExt = file.name.split('.').pop() || 'bin';
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2);
          const fileName = `${timestamp}-${randomId}.${fileExt}`;
          
          let filePath = `workspaces/${currentWorkspace.id}`;
          if (targetProjectId) {
            filePath += `/projects/${targetProjectId}`;
            if (targetFolderId) {
              filePath += `/folders/${targetFolderId}`;
            }
          }
          filePath += `/${fileName}`;

          updateUploadProgress(uploadId, 15);

          // Upload file to storage
          console.log(`Uploading to storage: ${filePath}`);
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('files')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error(`Upload failed: ${uploadError.message}`);
          }

          console.log('Storage upload successful:', uploadData);
          updateUploadProgress(uploadId, 40, 'processing');

          // Generate public URL for the uploaded file
          const fileUrl = generatePublicUrl(filePath);
          updateUploadProgress(uploadId, 50);

          // Generate thumbnail for images and videos
          let thumbnailUrl: string | null = null;
          let thumbnailPath: string | null = null;
          try {
            const thumbnailResult = await generateThumbnail(file);
            thumbnailPath = thumbnailResult.thumbnailPath;
            thumbnailUrl = thumbnailResult.thumbnailUrl;
            updateUploadProgress(uploadId, 70);
          } catch (thumbError) {
            console.warn('Thumbnail generation failed:', thumbError);
            // Continue without thumbnail
          }

          // Create database record with only manual tags
          const fileRecord: Omit<FileRecord, 'id' | 'created_at' | 'updated_at'> = {
            name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for display name
            original_name: file.name,
            file_path: filePath,
            file_type: file.type || 'application/octet-stream',
            file_category: getFileCategory(file.type || ''),
            file_size: file.size,
            file_url: fileUrl, // Store public URL for n8n automation
            thumbnail_url: thumbnailUrl,
            tags: manualTags || [], // Only manual tags initially
            is_favorite: false,
            workspace_id: currentWorkspace.id,
            project_id: targetProjectId,
            folder_id: targetFolderId,
          };

          console.log('Inserting database record:', fileRecord);
          updateUploadProgress(uploadId, 85);

          const { data: insertedFile, error: dbError } = await supabase
            .from('files')
            .insert([fileRecord])
            .select()
            .single();

          if (dbError) {
            console.error('Database insert error:', dbError);
            // Try to clean up uploaded file
            await supabase.storage.from('files').remove([filePath]);
            throw new Error(`Database error: ${dbError.message}`);
          }

          console.log('Database insert successful:', insertedFile);
          updateUploadProgress(uploadId, 95);

          // Send to n8n webhook for auto-tagging if enabled
          if (autoTaggingEnabled) {
            updateUploadProgress(uploadId, 98, 'tagging');
            await sendToN8nWebhook(insertedFile, fileUrl, thumbnailUrl, autoTaggingEnabled);
          }

          updateUploadProgress(uploadId, 100, 'complete');

          return insertedFile;

        } catch (error) {
          console.error(`Upload error for ${file.name}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          updateUploadProgress(uploadId, 0, 'error', errorMessage);
          return null;
        }
      });

      // Wait for all uploads to complete
      const results = await Promise.allSettled(uploadPromises);
      const successfulUploads = results
        .filter((result): result is PromiseFulfilledResult<FileRecord | null> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value as FileRecord);

      console.log(`Upload completed. ${successfulUploads.length} of ${fileArray.length} files uploaded successfully`);

      if (autoTaggingEnabled && successfulUploads.length > 0) {
        console.log(`${successfulUploads.length} files sent to n8n for AI auto-tagging`);
      }

      // Clear completed uploads after a delay
      setTimeout(() => {
        setUploads(prev => prev.filter(u => u.status === 'error'));
      }, 3000);

      return successfulUploads;

    } catch (error) {
      console.error('Upload initialization error:', error);
      setUploads(prev => prev.map(u => ({ ...u, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload failed' })));
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const clearUploads = () => {
    setUploads([]);
  };

  return {
    uploads,
    isUploading,
    uploadFiles,
    clearUploads,
  };
};