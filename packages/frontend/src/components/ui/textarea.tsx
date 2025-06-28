import * as React from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean
  minRows?: number
  maxRows?: number
  error?: string
  helperText?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ 
    className, 
    autoResize = false, 
    minRows = 3, 
    maxRows = 10, 
    error, 
    helperText,
    ...props 
  }, ref) => {
    const baseClasses = cn(
      'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      error && 'border-destructive focus-visible:ring-destructive',
      className
    )

    return (
      <div className="w-full">
        {autoResize ? (
          <TextareaAutosize
            className={baseClasses}
            ref={ref as React.Ref<HTMLTextAreaElement>}
            minRows={minRows}
            maxRows={maxRows}
            {...(props as any)}
          />
        ) : (
          <textarea
            className={baseClasses}
            ref={ref}
            {...props}
          />
        )}
        {(error || helperText) && (
          <div className="mt-1.5 text-sm">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              <span className="text-muted-foreground">{helperText}</span>
            )}
          </div>
        )}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }