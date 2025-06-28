import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '@/lib/utils'

// Import highlight.js styles
import 'highlight.js/styles/github-dark.css'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ 
  content, 
  className 
}: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      className={cn('prose prose-sm max-w-none dark:prose-invert', className)}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        // Code blocks
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !match
          
          if (isInline) {
            return (
              <code 
                className={cn(
                  'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
                  className
                )}
                {...props}
              >
                {children}
              </code>
            )
          }

          return (
            <div className="relative">
              {/* Language Label */}
              {match && (
                <div className="absolute top-0 right-0 z-10 rounded-bl-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {match[1]}
                </div>
              )}
              
              <pre className={cn('relative overflow-x-auto rounded-md bg-muted p-4', className)}>
                <code className={cn('font-mono text-sm', className)} {...props}>
                  {children}
                </code>
              </pre>
            </div>
          )
        },

        // Tables
        table({ children, ...props }) {
          return (
            <div className="my-6 w-full overflow-y-auto">
              <table className="w-full border-collapse border border-border" {...props}>
                {children}
              </table>
            </div>
          )
        },

        th({ children, ...props }) {
          return (
            <th 
              className="border border-border bg-muted px-4 py-2 text-left font-medium"
              {...props}
            >
              {children}
            </th>
          )
        },

        td({ children, ...props }) {
          return (
            <td className="border border-border px-4 py-2" {...props}>
              {children}
            </td>
          )
        },

        // Blockquotes
        blockquote({ children, ...props }) {
          return (
            <blockquote 
              className="mt-6 border-l-2 border-border pl-6 italic text-muted-foreground"
              {...props}
            >
              {children}
            </blockquote>
          )
        },

        // Links
        a({ children, href, ...props }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 hover:no-underline"
              {...props}
            >
              {children}
            </a>
          )
        },

        // Lists
        ul({ children, ...props }) {
          return (
            <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props}>
              {children}
            </ul>
          )
        },

        ol({ children, ...props }) {
          return (
            <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props}>
              {children}
            </ol>
          )
        },

        // Headings
        h1({ children, ...props }) {
          return (
            <h1 className="mt-6 mb-4 text-2xl font-bold tracking-tight" {...props}>
              {children}
            </h1>
          )
        },

        h2({ children, ...props }) {
          return (
            <h2 className="mt-6 mb-4 text-xl font-semibold tracking-tight" {...props}>
              {children}
            </h2>
          )
        },

        h3({ children, ...props }) {
          return (
            <h3 className="mt-6 mb-3 text-lg font-semibold tracking-tight" {...props}>
              {children}
            </h3>
          )
        },

        h4({ children, ...props }) {
          return (
            <h4 className="mt-4 mb-2 text-base font-semibold tracking-tight" {...props}>
              {children}
            </h4>
          )
        },

        // Paragraphs
        p({ children, ...props }) {
          return (
            <p className="leading-7 [&:not(:first-child)]:mt-3" {...props}>
              {children}
            </p>
          )
        },

        // Horizontal rule
        hr({ ...props }) {
          return (
            <hr className="my-4 border-t border-border" {...props} />
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
})