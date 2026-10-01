import React, {useEffect, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import EntangleServer from 'entangle-server';

import {usePreferencesStore} from '../preferences-state';
import {fonts, tokens} from '../theme';
import {Toggle} from './atoms/Toggle';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type ModelOption = {id: string; displayName: string; description?: string};

const FALLBACK_MODELS: ModelOption[] = [
  {id: 'default', displayName: 'Default (Auto)'},
  {id: 'composer-2.5', displayName: 'Composer 2.5'},
  {id: 'auto', displayName: 'Auto'},
];

export function PreferencesSheet({visible, onClose}: Props) {
  const prefs = usePreferencesStore();
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [readyDetail, setReadyDetail] = useState('');
  const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODELS);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setModelPickerOpen(false);
      return;
    }
    try {
      setReadyDetail(EntangleServer.cursorReadinessDetail());
    } catch {
      setReadyDetail('');
    }
    if (!prefs.cursorHasApiKey) {
      setModels(FALLBACK_MODELS);
      setModelsError(null);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    setModelsError(null);
    void EntangleServer.listCursorModels()
      .then(next => {
        if (cancelled) return;
        if (next?.length) {
          setModels(
            next.map(m => ({
              id: m.id,
              displayName: m.displayName || m.id,
              description: m.description,
            })),
          );
        } else {
          setModels(FALLBACK_MODELS);
        }
      })
      .catch(err => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Could not load models';
        setModelsError(message);
        setModels(FALLBACK_MODELS);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, prefs.cursorHasApiKey]);

  if (!visible) return null;

  const pasteAndSaveKey = async (): Promise<boolean> => {
    setApiKeySaving(true);
    setApiKeyError(null);
    try {
      const next = await EntangleServer.setCursorApiKeyFromClipboard();
      usePreferencesStore.setState(next);
      try {
        setReadyDetail(
          next.cursorReady ? 'Ready' : EntangleServer.cursorReadinessDetail(),
        );
      } catch {
        setReadyDetail(next.cursorReady ? 'Ready' : '');
      }
      if (!next.cursorHasApiKey) {
        setApiKeyError('Keychain did not keep the key');
        return false;
      }
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save API key';
      setApiKeyError(message);
      try {
        setReadyDetail(EntangleServer.cursorReadinessDetail());
      } catch {
        setReadyDetail('');
      }
      return false;
    } finally {
      setApiKeySaving(false);
    }
  };

  const selectModel = (id: string) => {
    void prefs.set('cursorModel', id);
    setModelPickerOpen(false);
  };

  const close = () => onClose();

  const selectedLabel =
    models.find(m => m.id === prefs.cursorModel)?.displayName ??
    prefs.cursorModel ??
    'Select model';

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Pressable style={styles.dismissCatcher} onPress={close} />
      <View style={styles.backdrop} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Preferences</Text>
            <Pressable onPress={close} style={styles.close}>
              <Text style={styles.closeLabel}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.body}
            nestedScrollEnabled>
            <SectionHeader label="Server" />
            <Field
              label="Server name"
              hint="Shown to phones during pairing"
              control={
                <TextInput
                  defaultValue={prefs.serverName}
                  style={styles.input}
                  onSubmitEditing={e =>
                    prefs.set('serverName', e.nativeEvent.text)
                  }
                  placeholderTextColor={tokens.textDim}
                />
              }
            />
            <Field
              label="Port"
              control={
                <View style={styles.inlineRow}>
                  <TextInput
                    defaultValue={prefs.port === 0 ? '' : String(prefs.port)}
                    keyboardType="number-pad"
                    placeholder="auto"
                    placeholderTextColor={tokens.textDim}
                    style={[styles.input, {width: 84, fontFamily: fonts.mono}]}
                    onSubmitEditing={e => {
                      const next = parseInt(e.nativeEvent.text, 10);
                      void prefs.set('port', Number.isFinite(next) ? next : 0);
                    }}
                  />
                  <View style={styles.checkbox}>
                    <Toggle
                      on={prefs.port === 0}
                      onChange={autoPick =>
                        prefs.set('port', autoPick ? 0 : 49827)
                      }
                    />
                    <Text style={styles.checkboxLabel}>Auto-pick</Text>
                  </View>
                </View>
              }
            />
            <Field
              label="Discoverable"
              hint="Advertise via Bonjour"
              control={
                <Toggle
                  on={prefs.discoverable}
                  onChange={v => prefs.set('discoverable', v)}
                />
              }
              last
            />

            <SectionHeader label="Pointer" />
            <Field
              label="Sensitivity"
              control={
                <SensitivitySlider
                  value={prefs.sensitivity}
                  onChange={v => prefs.set('sensitivity', v)}
                />
              }
            />
            <Field
              label="Natural scroll"
              hint="Content follows fingers"
              control={
                <Toggle
                  on={prefs.naturalScroll}
                  onChange={v => prefs.set('naturalScroll', v)}
                />
              }
            />
            <Field
              label="Tap to click"
              control={
                <Toggle
                  on={prefs.tapToClick}
                  onChange={v => prefs.set('tapToClick', v)}
                />
              }
            />
            <Field
              label="Highlight pointer"
              hint="Ring the cursor while a phone is connected"
              control={
                <Toggle
                  on={prefs.highlightPointer}
                  onChange={v => prefs.set('highlightPointer', v)}
                />
              }
            />
            <Field
              label="Clipboard sync"
              hint="Allow paired phones to sync text and images with this Mac"
              control={
                <Toggle
                  on={prefs.clipboardSync}
                  onChange={v => prefs.set('clipboardSync', v)}
                />
              }
              last
            />

            <SectionHeader label="Launch" />
            <Field
              label="Open at login"
              control={
                <Toggle
                  on={prefs.openAtLogin}
                  onChange={v => prefs.set('openAtLogin', v)}
                />
              }
            />
            <Field
              label="Show menu bar icon"
              control={
                <Toggle
                  on={prefs.showMenuBarIcon}
                  onChange={v => prefs.set('showMenuBarIcon', v)}
                />
              }
            />
            <Field
              label="Hide dock icon"
              hint="Run as a status-only app"
              control={
                <Toggle
                  on={prefs.hideDockIcon}
                  onChange={v => prefs.set('hideDockIcon', v)}
                />
              }
              last
            />

            <SectionHeader label="Cursor" />
            <Field
              label="Allow phones"
              hint="Advertise Cursor agent to paired phones. Needs Node 22.13+."
              control={
                <Toggle
                  on={prefs.cursorAllowPhones}
                  onChange={v => prefs.set('cursorAllowPhones', v)}
                />
              }
            />
            <Field
              label="API key"
              hint={
                apiKeyError
                  ? apiKeyError
                  : prefs.cursorHasApiKey
                    ? 'Stored in Keychain. Use a User key — Scope: Admin is not supported by the SDK.'
                    : 'Copy a User API key (not Admin) from cursor.com/dashboard/api, then Paste & Save'
              }
              control={
                <Pressable
                  style={[styles.browse, apiKeySaving && {opacity: 0.5}]}
                  disabled={apiKeySaving}
                  onPress={() => {
                    void pasteAndSaveKey();
                  }}>
                  <Text style={styles.browseLabel}>
                    {apiKeySaving
                      ? 'Saving…'
                      : prefs.cursorHasApiKey
                        ? 'Paste & Replace'
                        : 'Paste & Save'}
                  </Text>
                </Pressable>
              }
            />
            <Field
              label="Workspaces"
              hint="Folders or .code-workspace files phones may switch between. Tap a row to make it active."
              control={
                <Pressable
                  style={styles.browse}
                  onPress={() => {
                    void EntangleServer.pickCursorWorkspace().then(next => {
                      usePreferencesStore.setState(next);
                    });
                  }}>
                  <Text style={styles.browseLabel}>Add…</Text>
                </Pressable>
              }
            />
            {(prefs.cursorWorkspaceAllowlist?.length
              ? prefs.cursorWorkspaceAllowlist
              : prefs.cursorWorkspacePath
                ? [prefs.cursorWorkspacePath]
                : []
            ).map((path, index, list) => {
              const active = path === prefs.cursorWorkspacePath;
              const last = index === list.length - 1;
              const base = path.split('/').filter(Boolean).pop() || path;
              const name = base.toLowerCase().endsWith('.code-workspace')
                ? base.slice(0, -'.code-workspace'.length) || base
                : base;
              const kind = base.toLowerCase().endsWith('.code-workspace')
                ? 'Multi-root workspace'
                : 'Folder';
              return (
                <View
                  key={path}
                  style={[styles.workspaceRow, !last && styles.fieldBorder]}>
                  <Pressable
                    style={styles.workspaceMain}
                    onPress={() => {
                      void EntangleServer.setActiveCursorWorkspace(path).then(next => {
                        usePreferencesStore.setState(next);
                      });
                    }}>
                    <Text
                      style={[
                        styles.workspaceName,
                        active && styles.workspaceNameActive,
                      ]}
                      numberOfLines={1}>
                      {active ? '● ' : '○ '}
                      {name}
                    </Text>
                    <Text style={styles.workspacePath} numberOfLines={1}>
                      {kind} · {path}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.workspaceRemove}
                    onPress={() => {
                      void EntangleServer.removeCursorWorkspace(path).then(next => {
                        usePreferencesStore.setState(next);
                      });
                    }}>
                    <Text style={styles.workspaceRemoveLabel}>Remove</Text>
                  </Pressable>
                </View>
              );
            })}
            <Field
              label="Model"
              hint={
                modelsError
                  ? modelsError
                  : modelsLoading
                    ? 'Loading account models…'
                    : 'Tap to choose'
              }
              control={
                <Pressable
                  style={[styles.browse, {minWidth: 180}]}
                  onPress={() => setModelPickerOpen(open => !open)}>
                  <Text style={styles.browseLabel} numberOfLines={1}>
                    {selectedLabel}
                    {modelPickerOpen ? ' ▴' : ' ▾'}
                  </Text>
                </Pressable>
              }
            />
            {modelPickerOpen ? (
              <View style={styles.modelList}>
                <ScrollView nestedScrollEnabled style={{maxHeight: 200}}>
                  {models.map(model => {
                    const selected = model.id === prefs.cursorModel;
                    return (
                      <Pressable
                        key={model.id}
                        style={[
                          styles.modelRow,
                          selected && styles.modelRowSelected,
                        ]}
                        onPress={() => selectModel(model.id)}>
                        <Text
                          style={[
                            styles.modelName,
                            selected && styles.modelNameSelected,
                          ]}>
                          {model.displayName || model.id}
                        </Text>
                        {model.displayName &&
                        model.displayName !== model.id ? (
                          <Text style={styles.modelId}>{model.id}</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
            <Field
              label="Ready"
              hint={
                prefs.cursorReady
                  ? 'Phones will see the Cursor app'
                  : readyDetail || 'Needs allow + key + workspace + Node'
              }
              control={
                <Text style={styles.readyValue}>
                  {prefs.cursorReady ? 'Yes' : 'No'}
                </Text>
              }
              last
            />
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.done} onPress={close}>
              <Text style={styles.doneLabel}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function SectionHeader({label}: {label: string}) {
  return <Text style={styles.section}>{label}</Text>;
}

function Field({
  label,
  hint,
  control,
  last = false,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.field, !last && styles.fieldBorder]}>
      <View style={styles.fieldLabel}>
        <Text style={styles.fieldLabelText}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      <View style={styles.fieldControl}>{control}</View>
    </View>
  );
}

function SensitivitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const [local, setLocal] = useState(value);
  const min = 1;
  const max = 3;
  const ratio = (local - min) / (max - min);

  return (
    <View style={styles.sliderWrap}>
      <Text style={styles.sliderTick}>1×</Text>
      <Pressable
        style={styles.sliderTrack}
        onPress={e => {
          const layout = e.currentTarget;
          const x = e.nativeEvent.locationX;
          (layout as any).measure?.((_x: number, _y: number, width: number) => {
            const next = Math.min(
              max,
              Math.max(min, min + (x / width) * (max - min)),
            );
            setLocal(next);
            onChange(parseFloat(next.toFixed(1)));
          });
        }}>
        <View style={[styles.sliderFill, {width: `${ratio * 100}%`}]} />
        <View style={[styles.sliderThumb, {left: `${ratio * 100}%`}]} />
      </Pressable>
      <Text style={styles.sliderTick}>3×</Text>
      <Text style={styles.sliderValue}>{local.toFixed(1)}×</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  dismissCatcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,9,12,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: 540,
    maxHeight: '92%',
    backgroundColor: 'rgba(20,23,30,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  headerRow: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: -0.14,
    color: tokens.text,
  },
  close: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    color: tokens.textMid,
    fontSize: 11,
    lineHeight: 11,
  },
  bodyScroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 520,
  },
  body: {
    paddingBottom: 8,
  },
  section: {
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 20,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: tokens.textDim,
    borderTopWidth: 1,
    borderTopColor: tokens.divider,
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 20,
    gap: 20,
  },
  fieldBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  fieldLabel: {
    width: 180,
    alignItems: 'flex-end',
  },
  fieldLabelText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: tokens.textHigh,
    textAlign: 'right',
  },
  fieldHint: {
    fontSize: 10.5,
    color: tokens.textDim,
    marginTop: 1,
    textAlign: 'right',
  },
  fieldControl: {
    flex: 1,
  },
  input: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 6,
    color: tokens.text,
    fontSize: 12.5,
    minWidth: 200,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 12,
    color: tokens.textMid,
  },
  sliderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 280,
  },
  sliderTick: {
    fontSize: 10.5,
    color: tokens.textDim,
  },
  sliderTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  sliderFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: tokens.accent,
  },
  sliderThumb: {
    position: 'absolute',
    top: -4,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#fff',
    transform: [{translateX: -5.5}],
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 1},
  },
  sliderValue: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: tokens.text,
    minWidth: 32,
  },
  browse: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignSelf: 'flex-start',
  },
  browseLabel: {
    fontSize: 12.5,
    color: tokens.textHigh,
    fontWeight: '500',
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 12,
  },
  workspaceMain: {
    flex: 1,
    minWidth: 0,
  },
  workspaceName: {
    fontSize: 12.5,
    color: tokens.textMid,
    fontWeight: '500',
  },
  workspaceNameActive: {
    color: tokens.textHigh,
  },
  workspacePath: {
    fontSize: 10.5,
    color: tokens.textDim,
    marginTop: 2,
    fontFamily: fonts.mono,
  },
  workspaceRemove: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  workspaceRemoveLabel: {
    fontSize: 11.5,
    color: tokens.textDim,
  },
  modelList: {
    marginHorizontal: 20,
    marginBottom: 8,
    marginLeft: 200,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  modelRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modelRowSelected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modelName: {
    fontSize: 12.5,
    color: tokens.textHigh,
    fontWeight: '500',
  },
  modelNameSelected: {
    color: '#fff',
  },
  modelId: {
    marginTop: 2,
    fontFamily: fonts.mono,
    fontSize: 10,
    color: tokens.textDim,
  },
  readyValue: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: tokens.textMid,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  done: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
  },
  doneLabel: {
    color: '#0e1014',
    fontWeight: '500',
    fontSize: 12.5,
  },
});
