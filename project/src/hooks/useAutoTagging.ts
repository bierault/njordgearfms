import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

const N8N_WEBHOOK_URL = 'https://njord-gear.app.n8n.cloud/webhook/d2855857-3e7b-4465-b627-89ed188f2151';

export interface AutoTaggingResult {
  success: boolean;
  suggestedTags?: string[];
  error?: string;
}

export const useAutoTagging = () => {
  const triggerAutoTagging = useCallback(async (fileId: string): Promise<AutoTaggingResult> => {
    try {
      // Get file data from database
      const { data: file, error: fetchError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (fetchError || !file) {
        throw new Error('File not found');
      }

      // Generate public URLs for the file and thumbnail
      const fileUrl = file.file_url || (() => {
        const { data } = supabase.storage.from('files').getPublicUrl(file.file_path);
        return data.publicUrl;
      })();

      const thumbnailUrl = file.thumbnail_url || (() => {
        if (file.thumbnail_url) {
          return file.thumbnail_url;
        }
        // For images, use the file itself as thumbnail
        if (file.file_category === 'image') {
          return fileUrl;
        }
        return null;
      })();

      // Prepare webhook payload
      const webhookPayload = {
        fileId: file.id,
        fileName: file.name,
        originalName: file.original_name,
        fileType: file.file_type,
        fileCategory: file.file_category,
        fileSize: file.file_size,
        fileUrl: fileUrl,
        thumbnailUrl: thumbnailUrl,
        filePath: file.file_path,
        workspaceId: file.workspace_id,
        projectId: file.project_id,
        folderId: file.folder_id,
        currentTags: file.tags || [],
        timestamp: new Date().toISOString(),
        triggerType: 'manual', // Distinguish from automatic upload triggers
        context: {
          uploadSource: 'filevault-manual-retag'
        }
      };

      console.log('Sending manual auto-tagging request:', {
        fileId: webhookPayload.fileId,
        fileName: webhookPayload.fileName,
        fileUrl: webhookPayload.fileUrl,
        thumbnailUrl: webhookPayload.thumbnailUrl
      });

      // Send to n8n webhook
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
      console.log('Auto-tagging triggered successfully:', result);

      // Check if n8n returned tags immediately
      if (result.tags && Array.isArray(result.tags) && result.tags.length > 0) {
        console.log('Received immediate tags from n8n:', result.tags);
        
        // Update file tags in database
        const { error: updateError } = await supabase
          .from('files')
          .update({ tags: result.tags })
          .eq('id', fileId);

        if (updateError) {
          console.error('Failed to update file tags:', updateError);
          throw new Error('Failed to update file tags');
        }

        return {
          success: true,
          suggestedTags: result.tags
        };
      }

      return {
        success: true,
        suggestedTags: result.suggestedTags || []
      };

    } catch (error) {
      console.error('Auto-tagging failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Auto-tagging failed'
      };
    }
  }, []);

  const updateFileTags = useCallback(async (fileId: string, newTags: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ tags: newTags })
        .eq('id', fileId);

      if (error) throw error;

      console.log(`Updated tags for file ${fileId}:`, newTags);
      return true;

    } catch (error) {
      console.error('Failed to update file tags:', error);
      return false;
    }
  }, []);

  return {
    triggerAutoTagging,
    updateFileTags
  };
};