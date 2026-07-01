import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  SquareCode,
  Link as LinkIcon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// WYSIWYG editor for normies; markdown under the hood (agents write/read markdown
// via the API). SSR-safe (immediatelyRender: false). Uncontrolled after mount —
// remount via a `key` to load new content.
export function RichEditor({
  value,
  onChange,
  onBlur,
  editable = true,
  placeholder,
  minHeight = '5rem',
}: {
  value: string
  onChange?: (markdown: string) => void
  onBlur?: () => void
  editable?: boolean
  placeholder?: string
  minHeight?: string
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Markdown.configure({ html: false, breaks: true, transformPastedText: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange?.(editor.storage.markdown.getMarkdown()),
    onBlur: () => onBlur?.(),
  })

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editable, editor])

  return (
    <div className={cn('overflow-hidden rounded-xl border', editable ? 'border-line bg-[var(--theme-input)]' : 'border-transparent')}>
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="tiptap px-3 py-2 text-sm" style={{ minHeight }} />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  const Btn = ({ icon: Icon, active, onClick, title }: { icon: LucideIcon; active: boolean; onClick: () => void; title: string }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn('grid h-7 w-7 place-items-center rounded transition-colors', active ? 'bg-card2 text-accent' : 'text-muted hover:bg-card hover:text-fg')}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  )
  const c = editor.chain().focus()

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line-subtle px-2 py-1">
      <Btn icon={Bold} title="Bold" active={editor.isActive('bold')} onClick={() => c.toggleBold().run()} />
      <Btn icon={Italic} title="Italic" active={editor.isActive('italic')} onClick={() => c.toggleItalic().run()} />
      <Btn icon={Strikethrough} title="Strikethrough" active={editor.isActive('strike')} onClick={() => c.toggleStrike().run()} />
      <span className="mx-1 h-4 w-px bg-line-subtle" />
      <Btn icon={Heading2} title="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => c.toggleHeading({ level: 2 }).run()} />
      <Btn icon={List} title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => c.toggleBulletList().run()} />
      <Btn icon={ListOrdered} title="Numbered list" active={editor.isActive('orderedList')} onClick={() => c.toggleOrderedList().run()} />
      <Btn icon={Quote} title="Quote" active={editor.isActive('blockquote')} onClick={() => c.toggleBlockquote().run()} />
      <Btn icon={Code} title="Inline code" active={editor.isActive('code')} onClick={() => c.toggleCode().run()} />
      <Btn icon={SquareCode} title="Code block" active={editor.isActive('codeBlock')} onClick={() => c.toggleCodeBlock().run()} />
      <Btn
        icon={LinkIcon}
        title="Link"
        active={editor.isActive('link')}
        onClick={() => {
          const prev = editor.getAttributes('link').href as string | undefined
          const url = window.prompt('Link URL', prev ?? 'https://')
          if (url === null) return
          if (url === '') c.unsetLink().run()
          else c.setLink({ href: url }).run()
        }}
      />
    </div>
  )
}
