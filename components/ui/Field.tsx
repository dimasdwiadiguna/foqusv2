import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-block border border-border bg-surface-raised px-3 py-2.5 text-body placeholder:text-text-muted focus:border-accent focus:outline-none";

/** Label + input, with an optional muted worked example underneath (§6.7 wizard). */
export function TextField({
  label,
  example,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; example?: string; id: string }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-caption text-text-muted">
        {label}
      </label>
      <input id={id} className={`${control} min-h-11`} {...rest} />
      {example ? <p className="mt-1 text-caption text-text-muted italic">{example}</p> : null}
    </div>
  );
}

export function TextArea({
  label,
  example,
  id,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; example?: string; id: string }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-caption text-text-muted">
        {label}
      </label>
      <textarea id={id} rows={3} className={`${control} resize-none`} {...rest} />
      {example ? <p className="mt-1 text-caption text-text-muted italic">{example}</p> : null}
    </div>
  );
}

export const controlClass = control;
