import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { uploadFile } from '~/lib/upload';
import { Button } from './ui';

/** A button that picks a file, uploads it and hands back the URL. */
export function FilePicker({
  onUploaded,
  accept = 'image/*',
  children,
  variant = 'secondary',
  size = 'md',
  className,
  capture,
}: {
  onUploaded: (url: string, file: File) => void;
  accept?: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  capture?: 'user' | 'environment';
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        capture={capture}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            onUploaded(await uploadFile(file), file);
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button type="button" variant={variant} size={size} className={className} loading={busy} onClick={() => input.current?.click()}>
        {children}
      </Button>
    </>
  );
}
