import { createClient } from '@supabase/supabase-js';
import {
  Landlord,
  Property,
  Unit,
  Invoice,
  Transaction,
  PropertyBalances,
  FundingSource,
} from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jzpgknlbroofetpwsicp.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6cGdrbmxicm9vZmV0cHdzaWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDYyOTAsImV4cCI6MjEwOTEyMjI5MH0.qpDiFItDQshyvmxnXTChBpjK4DsyOeB6ZOEs2hU7z1A';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-supabase-url')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Synchronize auth state with browser cookie for Next.js Middleware route protection
 */
export function setAuthCookie(token: string, maxAge: number = 60 * 60 * 24 * 7) {
  if (typeof document === 'undefined') return;
  document.cookie = `sb-access-token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax';
}

if (typeof window !== 'undefined') {
  // Sync on initial load
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token) {
      setAuthCookie(session.access_token, session.expires_in || 60 * 60 * 24 * 7);
    }
  }).catch(() => {});

  // Sync on state change
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      setAuthCookie(session.access_token, session.expires_in || 60 * 60 * 24 * 7);
    } else if (event === 'SIGNED_OUT') {
      clearAuthCookie();
    }
  });
}

export async function getCurrentAuthUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Upload an image (File or base64 data URL) to the 'receipts' storage bucket.
 * Returns the public URL, or falls back to data URL if upload fails.
 */
export async function uploadReceiptToStorage(
  fileOrDataUrl: string,
  folder: 'proofs' | 'artisans' | 'logos' = 'proofs'
): Promise<string> {
  if (!fileOrDataUrl) return '';

  // If already an HTTP/HTTPS URL, return as is
  if (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://')) {
    return fileOrDataUrl;
  }

  try {
    // Convert base64 data URL to Blob
    let blob: Blob;
    let contentType = 'image/jpeg';
    let ext = 'jpg';

    if (fileOrDataUrl.startsWith('data:')) {
      const match = fileOrDataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        contentType = match[1];
        ext = contentType.split('/')[1] || 'jpg';
        const byteCharacters = atob(match[2]);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          byteArrays.push(new Uint8Array(byteNumbers));
        }
        blob = new Blob(byteArrays, { type: contentType });
      } else {
        return fileOrDataUrl;
      }
    } else {
      return fileOrDataUrl;
    }

    const fileName = `${folder}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, blob, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn('Storage upload warning:', uploadError.message, '- falling back to data URL');
      return fileOrDataUrl;
    }

    const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err) {
    console.warn('Error in uploadReceiptToStorage, using fallback data URL:', err);
    return fileOrDataUrl;
  }
}

/**
 * Upload a firm/chamber letterhead logo to the 'receipts' storage bucket:
 * Path: `receipts/logos/${managerId}_logo.${ext}`
 * Returns public URL or falls back to data URL.
 */
export async function uploadLogoToStorage(
  fileOrDataUrl: string,
  managerId: string = 'manager_default'
): Promise<string> {
  if (!fileOrDataUrl) return '';

  // If already an HTTP/HTTPS URL, return as is
  if (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://')) {
    return fileOrDataUrl;
  }

  try {
    let blob: Blob;
    let contentType = 'image/png';
    let ext = 'png';

    if (fileOrDataUrl.startsWith('data:')) {
      const match = fileOrDataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        contentType = match[1];
        ext = contentType.split('/')[1] || 'png';
        if (ext === 'jpeg') ext = 'jpg';
        const byteCharacters = atob(match[2]);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          byteArrays.push(new Uint8Array(byteNumbers));
        }
        blob = new Blob(byteArrays, { type: contentType });
      } else {
        return fileOrDataUrl;
      }
    } else {
      return fileOrDataUrl;
    }

    const cleanManagerId = managerId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `logos/${cleanManagerId}_logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, blob, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn('Logo upload warning:', uploadError.message, '- falling back to data URL');
      return fileOrDataUrl;
    }

    const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err) {
    console.warn('Error in uploadLogoToStorage, using fallback data URL:', err);
    return fileOrDataUrl;
  }
}
