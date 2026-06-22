/*
Copyright (C) 2025 QuantumNous

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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  Hand,
  KeyRound,
  PenLine,
  RotateCcw,
  Save,
  StickyNote,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { normalizeCustomUrl } from '../../helpers/customNavigation';

const { Text, Title } = Typography;

const STORAGE_KEY = 'newapi:classic:infinite-canvas:v1';
const API_SETTINGS_KEY = 'newapi:classic:infinite-canvas:api-settings';
const DEFAULT_API_URL = 'https://70api.top';
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const loadCanvasState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { notes: [], strokes: [] };
    const parsed = JSON.parse(raw);
    return {
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      strokes: Array.isArray(parsed.strokes) ? parsed.strokes : [],
    };
  } catch (error) {
    return { notes: [], strokes: [] };
  }
};

const loadApiSettings = () => {
  try {
    const raw = localStorage.getItem(API_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      apiUrl: normalizeCustomUrl(parsed.apiUrl) || DEFAULT_API_URL,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    };
  } catch (error) {
    return { apiUrl: DEFAULT_API_URL, apiKey: '' };
  }
};

export default function InfiniteCanvas() {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const interactionRef = useRef(null);
  const [tool, setTool] = useState('pan');
  const [viewport, setViewport] = useState({ x: 120, y: 96, scale: 1 });
  const initialCanvasState = useMemo(loadCanvasState, []);
  const [notes, setNotes] = useState(initialCanvasState.notes);
  const [strokes, setStrokes] = useState(initialCanvasState.strokes);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [apiSettings, setApiSettings] = useState(loadApiSettings);
  const [draftSettings, setDraftSettings] = useState(apiSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, strokes }));
  }, [notes, strokes]);

  const screenToWorld = useCallback(
    (clientX, clientY) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.x) / viewport.scale,
        y: (clientY - rect.top - viewport.y) / viewport.scale,
      };
    },
    [viewport],
  );

  const addNote = useCallback(
    (point) => {
      setNotes((current) => [
        ...current,
        {
          id: createId(),
          x: point.x,
          y: point.y,
          text: t('新便签'),
        },
      ]);
    },
    [t],
  );

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (tool === 'note') {
      addNote(screenToWorld(event.clientX, event.clientY));
      return;
    }

    if (tool === 'pen') {
      const point = screenToWorld(event.clientX, event.clientY);
      const stroke = {
        id: createId(),
        points: [point],
        color: 'var(--semi-color-primary)',
        width: 3,
      };
      interactionRef.current = { type: 'draw', strokeId: stroke.id };
      setStrokes((current) => [...current, stroke]);
      return;
    }

    interactionRef.current = {
      type: 'pan',
      startClient: { x: event.clientX, y: event.clientY },
      startViewport: viewport,
    };
  };

  const handlePointerMove = (event) => {
    const interaction = interactionRef.current;
    if (!interaction) return;

    if (interaction.type === 'pan') {
      const dx = event.clientX - interaction.startClient.x;
      const dy = event.clientY - interaction.startClient.y;
      setViewport({
        ...interaction.startViewport,
        x: interaction.startViewport.x + dx,
        y: interaction.startViewport.y + dy,
      });
      return;
    }

    if (interaction.type === 'draw') {
      const point = screenToWorld(event.clientX, event.clientY);
      setStrokes((current) =>
        current.map((stroke) => {
          if (stroke.id !== interaction.strokeId) return stroke;
          const previous = stroke.points[stroke.points.length - 1];
          if (
            previous &&
            Math.hypot(previous.x - point.x, previous.y - point.y) < 2
          ) {
            return stroke;
          }
          return { ...stroke, points: [...stroke.points, point] };
        }),
      );
      return;
    }

    if (interaction.type === 'note') {
      const point = screenToWorld(event.clientX, event.clientY);
      setNotes((current) =>
        current.map((note) =>
          note.id === interaction.noteId
            ? {
                ...note,
                x: point.x - interaction.offset.x,
                y: point.y - interaction.offset.y,
              }
            : note,
        ),
      );
    }
  };

  const handlePointerUp = (event) => {
    interactionRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture may already be released.
    }
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const nextScale = clamp(
      viewport.scale * (event.deltaY > 0 ? 0.9 : 1.1),
      MIN_SCALE,
      MAX_SCALE,
    );
    const world = screenToWorld(event.clientX, event.clientY);

    setViewport({
      x: event.clientX - rect.left - world.x * nextScale,
      y: event.clientY - rect.top - world.y * nextScale,
      scale: nextScale,
    });
  };

  const zoomBy = (factor) => {
    setViewport((current) => ({
      ...current,
      scale: clamp(current.scale * factor, MIN_SCALE, MAX_SCALE),
    }));
  };

  const resetView = () => {
    setViewport({ x: 120, y: 96, scale: 1 });
  };

  const clearCanvas = () => {
    setNotes([]);
    setStrokes([]);
  };

  const updateNoteText = (id, text) => {
    setNotes((current) =>
      current.map((note) => (note.id === id ? { ...note, text } : note)),
    );
  };

  const deleteNote = (id) => {
    setNotes((current) => current.filter((note) => note.id !== id));
  };

  const pathForStroke = (stroke) =>
    stroke.points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

  const handleOpenSettings = () => {
    setDraftSettings(apiSettings);
    setSettingsVisible(true);
  };

  const handleSaveSettings = () => {
    const nextSettings = {
      apiUrl: normalizeCustomUrl(draftSettings.apiUrl) || DEFAULT_API_URL,
      apiKey: draftSettings.apiKey || '',
    };
    localStorage.setItem(API_SETTINGS_KEY, JSON.stringify(nextSettings));
    setApiSettings(nextSettings);
    setSettingsVisible(false);
  };

  const toolButtons = [
    { key: 'pan', label: t('平移'), icon: Hand },
    { key: 'pen', label: t('画笔'), icon: PenLine },
    { key: 'note', label: t('便签'), icon: StickyNote },
  ];
  const gridSize = 32 * viewport.scale;

  return (
    <div style={{ padding: 24, height: 'calc(100vh - 64px)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Title heading={3} style={{ margin: 0 }}>
            {t('无限画布')}
          </Title>
          <Text type='secondary'>{apiSettings.apiUrl}</Text>
        </div>
        <Space wrap>
          {toolButtons.map((item) => (
            <Button
              key={item.key}
              type={tool === item.key ? 'primary' : 'tertiary'}
              theme={tool === item.key ? 'solid' : 'light'}
              icon={<item.icon size={16} />}
              onClick={() => setTool(item.key)}
            >
              {item.label}
            </Button>
          ))}
          <Button icon={<ZoomIn size={16} />} onClick={() => zoomBy(1.15)}>
            {t('画布放大')}
          </Button>
          <Button icon={<ZoomOut size={16} />} onClick={() => zoomBy(0.85)}>
            {t('画布缩小')}
          </Button>
          <Button icon={<RotateCcw size={16} />} onClick={resetView}>
            {t('重置视图')}
          </Button>
          <Button icon={<KeyRound size={16} />} onClick={handleOpenSettings}>
            API Key
          </Button>
          <Button
            type='danger'
            theme='light'
            icon={<Trash2 size={16} />}
            onClick={clearCanvas}
          >
            {t('清空')}
          </Button>
        </Space>
      </div>

      <Card bodyStyle={{ padding: 0 }}>
        <div
          ref={canvasRef}
          style={{
            height: 'calc(100vh - 190px)',
            minHeight: 480,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 8,
            cursor:
              tool === 'pan' ? 'grab' : tool === 'pen' ? 'crosshair' : 'copy',
            backgroundImage:
              'linear-gradient(to right, var(--semi-color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--semi-color-border) 1px, transparent 1px)',
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
          <Tag
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 3,
              pointerEvents: 'none',
            }}
          >
            {t('缩放')}: {Math.round(viewport.scale * 100)}%
          </Tag>

          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
              transformOrigin: '0 0',
            }}
          >
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                overflow: 'visible',
              }}
            >
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
                style={{
                  position: 'absolute',
                  left: note.x,
                  top: note.y,
                  width: 224,
                  overflow: 'hidden',
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 8,
                  background: 'var(--semi-color-bg-1)',
                  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.14)',
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 8px',
                    cursor: 'move',
                    borderBottom: '1px solid var(--semi-color-border)',
                    background: 'var(--semi-color-fill-0)',
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    const point = screenToWorld(event.clientX, event.clientY);
                    interactionRef.current = {
                      type: 'note',
                      noteId: note.id,
                      offset: {
                        x: point.x - note.x,
                        y: point.y - note.y,
                      },
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  <Text size='small' strong>
                    {t('便签')}
                  </Text>
                  <Button
                    size='small'
                    type='danger'
                    theme='borderless'
                    icon={<Trash2 size={14} />}
                    onClick={() => deleteNote(note.id)}
                  />
                </div>
                <textarea
                  value={note.text}
                  onChange={(event) =>
                    updateNoteText(note.id, event.target.value)
                  }
                  style={{
                    width: '100%',
                    minHeight: 96,
                    resize: 'none',
                    border: 0,
                    outline: 0,
                    padding: 12,
                    color: 'var(--semi-color-text-0)',
                    background: 'transparent',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Modal
        title={t('API 设置')}
        visible={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        onOk={handleSaveSettings}
        okText={t('保存')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <Text strong>{t('API 地址')}</Text>
            <Input
              value={draftSettings.apiUrl}
              placeholder={DEFAULT_API_URL}
              prefix={<KeyRound size={14} />}
              onChange={(value) =>
                setDraftSettings((current) => ({ ...current, apiUrl: value }))
              }
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <Text strong>API Key</Text>
            <Input
              value={draftSettings.apiKey}
              mode='password'
              prefix={<Save size={14} />}
              onChange={(value) =>
                setDraftSettings((current) => ({ ...current, apiKey: value }))
              }
              style={{ marginTop: 8 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
