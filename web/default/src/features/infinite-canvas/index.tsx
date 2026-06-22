/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Hand,
  PenLine,
  RotateCcw,
  StickyNote,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SectionPageLayout } from '@/components/layout'

type CanvasTool = 'pan' | 'pen' | 'note'

type Point = {
  x: number
  y: number
}

type Stroke = {
  id: string
  points: Point[]
  color: string
  width: number
}

type CanvasNote = {
  id: string
  x: number
  y: number
  text: string
}

type Viewport = {
  x: number
  y: number
  scale: number
}

type CanvasState = {
  notes: CanvasNote[]
  strokes: Stroke[]
}

type Interaction =
  | {
      type: 'pan'
      startClient: Point
      startViewport: Viewport
    }
  | {
      type: 'draw'
      strokeId: string
    }
  | {
      type: 'note'
      noteId: string
      offset: Point
    }

const STORAGE_KEY = 'newapi:infinite-canvas:v1'
const MIN_SCALE = 0.25
const MAX_SCALE = 2.5

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const loadCanvasState = (): CanvasState => {
  try {
    if (typeof window === 'undefined') return { notes: [], strokes: [] }
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { notes: [], strokes: [] }
    const parsed = JSON.parse(raw) as Partial<CanvasState>
    return {
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      strokes: Array.isArray(parsed.strokes) ? parsed.strokes : [],
    }
  } catch {
    return { notes: [], strokes: [] }
  }
}

export function InfiniteCanvas() {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const [tool, setTool] = useState<CanvasTool>('pan')
  const [viewport, setViewport] = useState<Viewport>({
    x: 120,
    y: 96,
    scale: 1,
  })
  const initialState = useMemo(loadCanvasState, [])
  const [notes, setNotes] = useState<CanvasNote[]>(initialState.notes)
  const [strokes, setStrokes] = useState<Stroke[]>(initialState.strokes)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, strokes }))
  }, [notes, strokes])

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (clientX - rect.left - viewport.x) / viewport.scale,
        y: (clientY - rect.top - viewport.y) / viewport.scale,
      }
    },
    [viewport]
  )

  const addNote = useCallback(
    (point: Point) => {
      setNotes((current) => [
        ...current,
        {
          id: createId(),
          x: point.x,
          y: point.y,
          text: t('New note'),
        },
      ])
    },
    [t]
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)

    if (tool === 'note') {
      addNote(screenToWorld(event.clientX, event.clientY))
      return
    }

    if (tool === 'pen') {
      const point = screenToWorld(event.clientX, event.clientY)
      const stroke: Stroke = {
        id: createId(),
        points: [point],
        color: 'hsl(var(--primary))',
        width: 3,
      }
      interactionRef.current = { type: 'draw', strokeId: stroke.id }
      setStrokes((current) => [...current, stroke])
      return
    }

    interactionRef.current = {
      type: 'pan',
      startClient: { x: event.clientX, y: event.clientY },
      startViewport: viewport,
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current
    if (!interaction) return

    if (interaction.type === 'pan') {
      const dx = event.clientX - interaction.startClient.x
      const dy = event.clientY - interaction.startClient.y
      setViewport({
        ...interaction.startViewport,
        x: interaction.startViewport.x + dx,
        y: interaction.startViewport.y + dy,
      })
      return
    }

    if (interaction.type === 'draw') {
      const point = screenToWorld(event.clientX, event.clientY)
      setStrokes((current) =>
        current.map((stroke) => {
          if (stroke.id !== interaction.strokeId) return stroke
          const previous = stroke.points[stroke.points.length - 1]
          if (
            previous &&
            Math.hypot(previous.x - point.x, previous.y - point.y) < 2
          ) {
            return stroke
          }
          return { ...stroke, points: [...stroke.points, point] }
        })
      )
      return
    }

    if (interaction.type === 'note') {
      const point = screenToWorld(event.clientX, event.clientY)
      setNotes((current) =>
        current.map((note) =>
          note.id === interaction.noteId
            ? {
                ...note,
                x: point.x - interaction.offset.x,
                y: point.y - interaction.offset.y,
              }
            : note
        )
      )
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    interactionRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* pointer may already be released */
    }
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const nextScale = clamp(
      viewport.scale * (event.deltaY > 0 ? 0.9 : 1.1),
      MIN_SCALE,
      MAX_SCALE
    )
    const world = screenToWorld(event.clientX, event.clientY)

    setViewport({
      x: event.clientX - rect.left - world.x * nextScale,
      y: event.clientY - rect.top - world.y * nextScale,
      scale: nextScale,
    })
  }

  const zoomBy = (factor: number) => {
    setViewport((current) => ({
      ...current,
      scale: clamp(current.scale * factor, MIN_SCALE, MAX_SCALE),
    }))
  }

  const resetView = () => {
    setViewport({ x: 120, y: 96, scale: 1 })
  }

  const clearCanvas = () => {
    setNotes([])
    setStrokes([])
  }

  const updateNoteText = (id: string, text: string) => {
    setNotes((current) =>
      current.map((note) => (note.id === id ? { ...note, text } : note))
    )
  }

  const deleteNote = (id: string) => {
    setNotes((current) => current.filter((note) => note.id !== id))
  }

  const pathForStroke = (stroke: Stroke) =>
    stroke.points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ')

  const gridSize = 32 * viewport.scale
  const toolButtons: Array<{
    key: CanvasTool
    label: string
    icon: React.ElementType
  }> = [
    { key: 'pan', label: t('Pan'), icon: Hand },
    { key: 'pen', label: t('Pen'), icon: PenLine },
    { key: 'note', label: t('Note'), icon: StickyNote },
  ]

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Infinite Canvas')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <div className='flex flex-wrap items-center gap-2'>
          {toolButtons.map((item) => (
            <Button
              key={item.key}
              type='button'
              variant={tool === item.key ? 'default' : 'outline'}
              onClick={() => setTool(item.key)}
            >
              <item.icon />
              {item.label}
            </Button>
          ))}
          <Button type='button' variant='outline' onClick={() => zoomBy(1.15)}>
            <ZoomIn />
            {t('Zoom in')}
          </Button>
          <Button type='button' variant='outline' onClick={() => zoomBy(0.85)}>
            <ZoomOut />
            {t('Zoom out')}
          </Button>
          <Button type='button' variant='outline' onClick={resetView}>
            <RotateCcw />
            {t('Reset view')}
          </Button>
          <Button type='button' variant='outline' onClick={clearCanvas}>
            <Trash2 />
            {t('Clear')}
          </Button>
        </div>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div
          ref={canvasRef}
          className={cn(
            'bg-background relative h-[calc(100svh-10rem)] overflow-hidden rounded-lg border',
            tool === 'pan' && 'cursor-grab',
            tool === 'pen' && 'cursor-crosshair',
            tool === 'note' && 'cursor-copy'
          )}
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          <div className='bg-background/90 text-muted-foreground pointer-events-none absolute top-3 left-3 rounded-md border px-2 py-1 text-xs shadow-sm'>
            {t('Scale')}: {Math.round(viewport.scale * 100)}%
          </div>

          <div
            className='absolute top-0 left-0'
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
              transformOrigin: '0 0',
            }}
          >
            <svg className='absolute top-0 left-0 overflow-visible'>
              {strokes.map((stroke) => (
                <path
                  key={stroke.id}
                  d={pathForStroke(stroke)}
                  fill='none'
                  stroke={stroke.color}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={stroke.width}
                />
              ))}
            </svg>

            {notes.map((note) => (
              <div
                key={note.id}
                className='bg-background absolute w-56 overflow-hidden rounded-lg border shadow-sm'
                style={{ left: note.x, top: note.y }}
              >
                <div
                  className='bg-muted/70 flex cursor-move items-center justify-between gap-2 border-b px-2 py-1'
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    const point = screenToWorld(event.clientX, event.clientY)
                    interactionRef.current = {
                      type: 'note',
                      noteId: note.id,
                      offset: {
                        x: point.x - note.x,
                        y: point.y - note.y,
                      },
                    }
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  <span className='truncate text-xs font-medium'>
                    {t('Note')}
                  </span>
                  <button
                    type='button'
                    className='text-muted-foreground hover:text-foreground'
                    aria-label={t('Delete note')}
                    onClick={() => deleteNote(note.id)}
                  >
                    <Trash2 className='size-3.5' />
                  </button>
                </div>
                <textarea
                  value={note.text}
                  onChange={(event) =>
                    updateNoteText(note.id, event.target.value)
                  }
                  className='min-h-24 w-full resize-none bg-transparent p-3 text-sm outline-none'
                />
              </div>
            ))}
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
