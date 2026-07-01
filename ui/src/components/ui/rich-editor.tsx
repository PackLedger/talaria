import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
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
  const btn = (active: boolean) =>
    cn('rounded px-1.5 py-0.5 text-xs transition-colors', active ? 'bg-card2 text-accent' : 'text-muted hover:text-fg')
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line-subtle px-2 py-1">
      <button type="button" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
      <button type="button" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>i</i></button>
      <button type="button" className={btn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button>
      <span className="mx-1 text-line">|</span>
      <button type="button" className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H</button>
      <button type="button" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</button>
      <button type="button" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</button>
      <button type="button" className={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</button>
      <button type="button" className={btn(editor.isActive('code'))} onClick={() => editor.chain().focus().toggleCode().run()}>{'</>'}</button>
      <button type="button" className={btn(editor.isActive('codeBlock'))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>▤</button>
      <button
        type="button"
        className={btn(editor.isActive('link'))}
        onClick={() => {
          const prev = editor.getAttributes('link').href as string | undefined
          const url = window.prompt('Link URL', prev ?? 'https://')
          if (url === null) return
          if (url === '') editor.chain().focus().unsetLink().run()
          else editor.chain().focus().setLink({ href: url }).run()
        }}
      >
        🔗
      </button>
    </div>
  )
}
